import { z } from "zod";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { JenkinsClient } from "../jenkins/client.js";
import { JenkinsClientError } from "../jenkins/client.js";
import type { JenkinsAction, JenkinsBuild, JenkinsJob, JenkinsRootInfo } from "../jenkins/types.js";
import { jobFullNameToPath } from "../jenkins/utils.js";
import { getLogger } from "../logger.js";
import { toMcpResult, toolEmpty, toolError, toolNotFound, toolSuccess } from "../response.js";

interface GitScmConfig {
    uris: string[];
    branches: string[];
    commit?: string;
}

export function registerScmTools(server: McpServer, client: JenkinsClient): void {
    const logger = getLogger();

    // ── getJobScm ────────────────────────────────────────────────────────
    server.registerTool(
        "getJobScm",
        {
            description: "Retrieves SCM configurations of a Jenkins job",
            inputSchema: {
                jobFullName: z.string().describe("Full name of the Jenkins job")
            },
            annotations: { readOnlyHint: true }
        },
        async({ jobFullName }) => {
            logger.debug(`getJobScm: ${jobFullName}`);

            try {
                const path = `${jobFullNameToPath(jobFullName)}/api/json`;
                const job = await client.get<JenkinsJob>(path, {
                    tree: "scm[userRemoteConfigs[url],branches[name]],actions[remoteUrls,lastBuiltRevision[SHA1,branch[SHA1,name]]]"
                });

                const configs = extractScmFromJob(job);

                if (configs.length === 0) {
                    return toMcpResult(toolEmpty("No SCM configurations found for this job."));
                }

                return toMcpResult(toolSuccess(configs));
            } catch (error) {
                if (error instanceof JenkinsClientError && error.statusCode === 404) {
                    return toMcpResult(toolNotFound("Job", jobFullName));
                }

                return toMcpResult(toolError(error));
            }
        }
    );

    // ── getBuildScm ──────────────────────────────────────────────────────
    server.registerTool(
        "getBuildScm",
        {
            description: "Retrieves SCM configurations of a Jenkins build",
            inputSchema: {
                jobFullName: z.string().describe("Full name of the Jenkins job"),
                buildNumber: z.number().int().optional().describe("Build number (omit for last build)")
            },
            annotations: { readOnlyHint: true }
        },
        async({ jobFullName, buildNumber }) => {
            logger.debug(`getBuildScm: ${jobFullName}#${buildNumber ?? "last"}`);

            try {
                const buildPath = buildNumber ? `/${buildNumber}` : "/lastBuild";
                const path = `${jobFullNameToPath(jobFullName)}${buildPath}/api/json`;
                const build = await client.get<JenkinsBuild>(path, {
                    tree: "actions[remoteUrls,lastBuiltRevision[SHA1,branch[SHA1,name]],buildsByBranchName]"
                });

                const configs = extractScmFromBuild(build);

                if (configs.length === 0) {
                    return toMcpResult(toolEmpty("No SCM configurations found for this build."));
                }

                return toMcpResult(toolSuccess(configs));
            } catch (error) {
                if (error instanceof JenkinsClientError && error.statusCode === 404) {
                    const id = buildNumber ? `${jobFullName}#${buildNumber}` : `${jobFullName} (last build)`;

                    return toMcpResult(toolNotFound("Build", id));
                }

                return toMcpResult(toolError(error));
            }
        }
    );

    // ── getBuildChangeSets ───────────────────────────────────────────────
    server.registerTool(
        "getBuildChangeSets",
        {
            description: "Retrieves change log sets of a Jenkins build",
            inputSchema: {
                jobFullName: z.string().describe("Full name of the Jenkins job"),
                buildNumber: z.number().int().optional().describe("Build number (omit for last build)")
            },
            annotations: { readOnlyHint: true }
        },
        async({ jobFullName, buildNumber }) => {
            logger.debug(`getBuildChangeSets: ${jobFullName}#${buildNumber ?? "last"}`);

            try {
                const buildPath = buildNumber ? `/${buildNumber}` : "/lastBuild";
                const path = `${jobFullNameToPath(jobFullName)}${buildPath}/api/json`;
                const build = await client.get<JenkinsBuild>(path, {
                    tree: "changeSets[items[commitId,timestamp,msg,comment,author[fullName,absoluteUrl],affectedPaths,paths[editType,file]],kind]"
                });

                return toMcpResult(toolSuccess(build.changeSets ?? []));
            } catch (error) {
                if (error instanceof JenkinsClientError && error.statusCode === 404) {
                    const id = buildNumber ? `${jobFullName}#${buildNumber}` : `${jobFullName} (last build)`;

                    return toMcpResult(toolNotFound("Build", id));
                }

                return toMcpResult(toolError(error));
            }
        }
    );

    // ── findJobsWithScmUrl ───────────────────────────────────────────────
    server.registerTool(
        "findJobsWithScmUrl",
        {
            description: "Get a paginated list of Jenkins jobs that use the specified git SCM URL",
            inputSchema: {
                scmUrl: z.string().describe("Git SCM URL to search for"),
                branch: z.string().optional().describe("Branch name to filter by"),
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
        async({ scmUrl, branch, skip = 0, limit = 10 }) => {
            logger.debug(`findJobsWithScmUrl: ${scmUrl}, branch=${branch ?? "any"}`);

            try {
                // Fetch all jobs recursively with SCM info
                const data = await client.get<JenkinsRootInfo>("/api/json", {
                    tree: "jobs[name,fullName,url,color,scm[userRemoteConfigs[url],branches[name]],actions[remoteUrls]]"
                });

                const allJobs = flattenJobs(data.jobs ?? []);

                // Filter by SCM URL
                const matching = allJobs.filter(job => {
                    const scmUrls = extractJobScmUrls(job);

                    if (!scmUrls.some(u => looselyMatchesUrl(u, scmUrl))) {
                        return false;
                    }

                    if (branch) {
                        const branches = extractJobBranches(job);

                        return branches.some(b => matchesBranch(b, branch));
                    }

                    return true;
                });

                const paged = matching.slice(skip, skip + limit);

                if (paged.length === 0) {
                    return toMcpResult(toolEmpty("No jobs found matching the specified SCM URL."));
                }

                return toMcpResult(toolSuccess(paged));
            } catch (error) {
                if (error instanceof JenkinsClientError) {
                    return toMcpResult(toolEmpty(`Failed to search jobs: ${error.message}`));
                }

                return toMcpResult(toolError(error));
            }
        }
    );
}

// ── Helper functions ─────────────────────────────────────────────────────

function extractScmFromJob(job: JenkinsJob): GitScmConfig[] {
    const configs: GitScmConfig[] = [];

    // From SCM config (Pipeline/Multibranch)
    if (job.scm?.userRemoteConfigs) {
        const uris = job.scm.userRemoteConfigs.
            map(c => c.url).
            filter((u): u is string => !!u);

        const branches = job.scm.branches?.
            map(b => b.name).
            filter((n): n is string => !!n) ?? [];

        if (uris.length > 0) {
            configs.push({ uris, branches });
        }
    }

    // From Git build actions
    if (job.actions) {
        for (const action of job.actions) {
            const scm = extractScmFromAction(action);

            if (scm) {
                configs.push(scm);
            }
        }
    }

    return configs;
}

function extractScmFromBuild(build: JenkinsBuild): GitScmConfig[] {
    const configs: GitScmConfig[] = [];

    if (!build.actions) {
        return configs;
    }

    for (const action of build.actions) {
        const scm = extractScmFromAction(action);

        if (scm) {
            configs.push(scm);
        }
    }

    return configs;
}

function extractScmFromAction(action: JenkinsAction): GitScmConfig | null {
    if (!action.remoteUrls?.length) {
        return null;
    }

    const uris = action.remoteUrls;
    const branches: string[] = [];
    let commit: string | undefined;

    if (action.lastBuiltRevision) {
        commit = action.lastBuiltRevision.SHA1;

        if (action.lastBuiltRevision.branch) {
            for (const b of action.lastBuiltRevision.branch) {
                if (b.name) {
                    branches.push(b.name);
                }
            }
        }
    }

    return { uris, branches, commit };
}

function extractJobScmUrls(job: JenkinsJob): string[] {
    const urls: string[] = [];

    if (job.scm?.userRemoteConfigs) {
        for (const c of job.scm.userRemoteConfigs) {
            if (c.url) {
                urls.push(c.url);
            }
        }
    }

    if (job.actions) {
        for (const action of job.actions) {
            if (action.remoteUrls) {
                urls.push(...action.remoteUrls);
            }
        }
    }

    return urls;
}

function extractJobBranches(job: JenkinsJob): string[] {
    const branches: string[] = [];

    if (job.scm?.branches) {
        for (const b of job.scm.branches) {
            if (b.name) {
                branches.push(b.name);
            }
        }
    }

    return branches;
}

/**
 * Loosely matches SCM URLs (ignoring .git suffix, protocol, trailing slashes).
 */
function looselyMatchesUrl(configuredUrl: string, targetUrl: string): boolean {
    const normalize = (u: string) => u.
        replace(/\.git$/, "").
        replace(/\/+$/, "").
        replace(/^(https?|git|ssh):\/\//, "").
        replace(/^[^@]+@/, "").
        replace(/:/, "/").
        toLowerCase();

    return normalize(configuredUrl) === normalize(targetUrl);
}

/**
 * Matches a branch spec against a branch name.
 * Handles wildcard patterns like star/main or double-star.
 */
function matchesBranch(spec: string, branch: string): boolean {
    const normalizedSpec = spec.replace(/^\*\//, "");
    const normalizedBranch = branch.replace(/^refs\/remotes\/origin\//, "").replace(/^origin\//, "");

    if (spec === "**") {
        return true;
    }

    return normalizedSpec === normalizedBranch;
}

/**
 * Recursively flatten a nested job tree (folders contain jobs).
 */
function flattenJobs(jobs: JenkinsJob[]): JenkinsJob[] {
    const result: JenkinsJob[] = [];

    for (const job of jobs) {
        if (job.jobs) {
            // This is a folder — recurse
            result.push(...flattenJobs(job.jobs));
        } else {
            result.push(job);
        }
    }

    return result;
}
