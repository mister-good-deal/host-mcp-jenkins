import { z } from "zod";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { JenkinsClient } from "../jenkins/client.js";
import { JenkinsClientError } from "../jenkins/client.js";
import type { JenkinsBuild, JenkinsComputerSet, JenkinsJob, JenkinsQueue, JenkinsQueueItem, JenkinsRootInfo, JenkinsUser } from "../jenkins/types.js";
import { jobFullNameToPath } from "../jenkins/utils.js";
import { getLogger } from "../logger.js";
import { toMcpResult, toolError, toolFailure, toolNotFound, toolSuccess } from "../response.js";

export function registerCoreTools(server: McpServer, client: JenkinsClient): void {
    const logger = getLogger();

    /*
     * ── getJob ───────────────────────────────────────────────────────────
     * Jenkins API: GET /job/{name}/api/json
     * @see https://www.jenkins.io/doc/book/using/remote-access-api/
     */
    server.registerTool(
        "getJob",
        {
            description: "Get a Jenkins job by its full path",
            inputSchema: {
                jobFullName: z.string().describe("Full name of the Jenkins job (e.g., 'folder/myJob')"),
                tree: z.string().optional().describe("Jenkins tree parameter to filter response fields")
            },
            annotations: { readOnlyHint: true }
        },
        async({ jobFullName, tree }) => {
            logger.debug(`getJob: ${jobFullName}`);

            try {
                const path = `${jobFullNameToPath(jobFullName)}/api/json`;
                const job = await client.get<JenkinsJob>(path, { tree });

                return toMcpResult(toolSuccess(job));
            } catch (error) {
                if (error instanceof JenkinsClientError && error.statusCode === 404) {
                    return toMcpResult(toolNotFound("Job", jobFullName));
                }

                return toMcpResult(toolError(error));
            }
        }
    );

    /*
     * ── getJobs ──────────────────────────────────────────────────────────
     * Jenkins API: GET /api/json (root) or GET /job/{folder}/api/json
     * @see https://www.jenkins.io/doc/book/using/remote-access-api/
     */
    server.registerTool(
        "getJobs",
        {
            description: "Get a paginated list of Jenkins jobs, sorted by name",
            inputSchema: {
                parentFullName: z.string().optional().describe("Full name of the parent folder (omit for root)"),
                skip: z.number().int().min(0).default(0).
                    optional().
                    describe("Number of jobs to skip"),
                limit: z.number().int().min(1).max(10).
                    default(10).
                    optional().
                    describe("Maximum number of jobs to return (max 10)")
            },
            annotations: { readOnlyHint: true }
        },
        async({ parentFullName, skip = 0, limit = 10 }) => {
            logger.debug(`getJobs: parent=${parentFullName ?? "root"}, skip=${skip}, limit=${limit}`);

            try {
                const basePath = parentFullName
                    ? `${jobFullNameToPath(parentFullName)}/api/json`
                    : "/api/json";

                const data = await client.get<JenkinsRootInfo | JenkinsJob>(basePath, {
                    tree: "jobs[name,fullName,url,color,displayName,description]"
                });

                const jobs = (data as JenkinsRootInfo).jobs ?? (data as JenkinsJob).jobs ?? [];
                const sorted = [...jobs].sort((a, b) => a.name.localeCompare(b.name));
                const paged = sorted.slice(skip, skip + limit);

                return toMcpResult(toolSuccess(paged));
            } catch (error) {
                if (error instanceof JenkinsClientError && error.statusCode === 404) {
                    return toMcpResult(toolNotFound("Folder", parentFullName ?? "root"));
                }

                return toMcpResult(toolError(error));
            }
        }
    );

    /*
     * ── getBuild ─────────────────────────────────────────────────────────
     * Jenkins API: GET /job/{name}/{buildNumber}/api/json or /job/{name}/lastBuild/api/json
     * @see https://www.jenkins.io/doc/book/using/remote-access-api/
     */
    server.registerTool(
        "getBuild",
        {
            description: "Get a specific build or the last build of a Jenkins job",
            inputSchema: {
                jobFullName: z.string().describe("Full name of the Jenkins job"),
                buildNumber: z.number().int().optional().describe("Build number (omit for last build)"),
                tree: z.string().optional().describe("Jenkins tree parameter to filter response fields")
            },
            annotations: { readOnlyHint: true }
        },
        async({ jobFullName, buildNumber, tree }) => {
            logger.debug(`getBuild: ${jobFullName}#${buildNumber ?? "last"}`);

            try {
                const buildPath = buildNumber ? `/${buildNumber}` : "/lastBuild";
                const path = `${jobFullNameToPath(jobFullName)}${buildPath}/api/json`;
                const build = await client.get<JenkinsBuild>(path, { tree });

                return toMcpResult(toolSuccess(build));
            } catch (error) {
                if (error instanceof JenkinsClientError && error.statusCode === 404) {
                    const id = buildNumber ? `${jobFullName}#${buildNumber}` : `${jobFullName} (last build)`;

                    return toMcpResult(toolNotFound("Build", id));
                }

                return toMcpResult(toolError(error));
            }
        }
    );

    /*
     * ── triggerBuild ─────────────────────────────────────────────────────
     * Jenkins API: POST /job/{name}/build or /job/{name}/buildWithParameters
     * @see https://www.jenkins.io/doc/book/using/remote-access-api/#RemoteaccessAPI-Submittingjobs
     */
    server.registerTool(
        "triggerBuild",
        {
            description: "Trigger a build for a Jenkins job",
            inputSchema: {
                jobFullName: z.string().describe("Full name of the Jenkins job"),
                parameters: z.record(z.unknown()).optional().
                    describe("Build parameters as key-value pairs")
            },
            annotations: { readOnlyHint: false }
        },
        async({ jobFullName, parameters }) => {
            logger.debug(`triggerBuild: ${jobFullName}`);

            try {
                const jobPath = jobFullNameToPath(jobFullName);

                let result: { data: JenkinsQueueItem | null; location: string | null };

                if (parameters && Object.keys(parameters).length > 0) {
                    const formData = new URLSearchParams();

                    formData.set("json", JSON.stringify({ parameter: Object.entries(parameters).map(([name, value]) => ({ name, value })) }));

                    result = await client.post<JenkinsQueueItem>(
                        `${jobPath}/buildWithParameters`,
                        formData
                    );
                } else result = await client.post<JenkinsQueueItem>(`${jobPath}/build`);

                // Try to fetch queue item from Location header
                if (result.location) {
                    try {
                        const queueUrl = new URL(result.location);
                        const queuePath = `${queueUrl.pathname}api/json`;
                        const queueItem = await client.get<JenkinsQueueItem>(queuePath);

                        return toMcpResult(toolSuccess(queueItem, "Build triggered successfully."));
                    } catch {
                    // If we can't fetch queue item, still report success
                        return toMcpResult(toolSuccess(
                            { queueLocation: result.location },
                            "Build triggered successfully."
                        ));
                    }
                }

                return toMcpResult(toolSuccess(result.data, "Build triggered successfully."));
            } catch (error) {
                if (error instanceof JenkinsClientError && error.statusCode === 404) {
                    return toMcpResult(toolNotFound("Job", jobFullName));
                }

                return toMcpResult(toolError(error));
            }
        }
    );

    /*
     * ── updateBuild ──────────────────────────────────────────────────────
     * Jenkins API: POST /job/{name}/{buildNumber}/submitDescription and /job/{name}/{buildNumber}/configSubmit
     * @see https://javadoc.jenkins.io/hudson/model/Run.html
     */
    server.registerTool(
        "updateBuild",
        {
            description: "Update build display name and/or description",
            inputSchema: {
                jobFullName: z.string().describe("Full name of the Jenkins job"),
                buildNumber: z.number().int().optional().describe("Build number (omit for last build)"),
                displayName: z.string().optional().describe("New display name for the build"),
                description: z.string().optional().describe("New description for the build")
            },
            annotations: { readOnlyHint: false }
        },
        async({ jobFullName, buildNumber, displayName, description }) => {
            logger.debug(`updateBuild: ${jobFullName}#${buildNumber ?? "last"}`);

            if (!displayName && !description) {
                return toMcpResult(toolFailure("At least one of displayName or description must be provided."));
            }

            try {
                const buildPath = buildNumber ? `/${buildNumber}` : "/lastBuild";
                const basePath = `${jobFullNameToPath(jobFullName)}${buildPath}`;

                if (description !== undefined) {
                    await client.post(`${basePath}/submitDescription`, new URLSearchParams({ description }));
                }

                if (displayName !== undefined) {
                    await client.post(`${basePath}/configSubmit`, new URLSearchParams({ displayName }));
                }

                return toMcpResult(toolSuccess(true, "Build updated successfully."));
            } catch (error) {
                if (error instanceof JenkinsClientError && error.statusCode === 404) {
                    const id = buildNumber ? `${jobFullName}#${buildNumber}` : `${jobFullName} (last build)`;

                    return toMcpResult(toolNotFound("Build", id));
                }

                return toMcpResult(toolError(error));
            }
        }
    );

    /*
     * ── whoAmI ───────────────────────────────────────────────────────────
     * Jenkins API: GET /me/api/json
     * @see https://javadoc.jenkins.io/hudson/model/User.html
     */
    server.registerTool(
        "whoAmI",
        {
            description: "Get information about the currently authenticated user",
            annotations: { readOnlyHint: true }
        },
        async() => {
            logger.debug("whoAmI");

            try {
                const user = await client.get<JenkinsUser>("/me/api/json");

                return toMcpResult(toolSuccess({ fullName: user.fullName }));
            } catch (error) {
                return toMcpResult(toolError(error));
            }
        }
    );

    /*
     * ── getStatus ────────────────────────────────────────────────────────
     * Jenkins API: GET /api/json, GET /computer/api/json, GET /queue/api/json
     * @see https://www.jenkins.io/doc/book/using/remote-access-api/
     * @see https://javadoc.jenkins.io/hudson/model/Computer.html
     * @see https://javadoc.jenkins.io/hudson/model/Queue.html
     */
    server.registerTool(
        "getStatus",
        {
            description: "Checks the health and readiness status of a Jenkins instance",
            annotations: { readOnlyHint: true }
        },
        async() => {
            logger.debug("getStatus");

            try {
                const [root, computers, queue] = await Promise.all([
                    client.get<JenkinsRootInfo>("/api/json", {
                        tree: "quietingDown,url,nodeDescription,numExecutors"
                    }),
                    client.get<JenkinsComputerSet>("/computer/api/json", {
                        tree: "busyExecutors,totalExecutors,computer[displayName,idle,offline,temporarilyOffline,numExecutors]"
                    }),
                    client.get<JenkinsQueue>("/queue/api/json", {
                        tree: "items[id,task[name],why,blocked,buildable,stuck]"
                    })
                ]);

                const availableExecutors = computers.computer.
                    filter(c => !c.offline).
                    reduce((sum, c) => sum + c.numExecutors, 0) - computers.busyExecutors;

                const status: Record<string, unknown> = {
                    "Quiet Mode": root.quietingDown ?? false,
                    "Full Queue Size": queue.items.length,
                    "Buildable Queue Size": queue.items.filter(i => i.buildable).length,
                    "Available executors (any label)": availableExecutors,
                    "Root URL Status": root.url ? "configured" : "not configured"
                };

                return toMcpResult(toolSuccess(status));
            } catch (error) {
                return toMcpResult(toolError(error));
            }
        }
    );

    /*
     * ── getQueueItem ─────────────────────────────────────────────────────
     * Jenkins API: GET /queue/item/{id}/api/json
     * @see https://javadoc.jenkins.io/hudson/model/Queue.html
     */
    server.registerTool(
        "getQueueItem",
        {
            description: "Get the queue item details by its ID",
            inputSchema: {
                id: z.number().int().describe("Queue item ID"),
                tree: z.string().optional().describe("Jenkins tree parameter to filter response fields")
            },
            annotations: { readOnlyHint: true }
        },
        async({ id, tree }) => {
            logger.debug(`getQueueItem: ${id}`);

            try {
                const item = await client.get<JenkinsQueueItem>(`/queue/item/${id}/api/json`, { tree });

                return toMcpResult(toolSuccess(item));
            } catch (error) {
                if (error instanceof JenkinsClientError && error.statusCode === 404) {
                    return toMcpResult(toolNotFound("Queue item", String(id)));
                }

                return toMcpResult(toolError(error));
            }
        }
    );
}
