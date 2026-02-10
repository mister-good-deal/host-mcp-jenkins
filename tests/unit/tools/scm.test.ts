import { describe, it, expect, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerScmTools } from "../../../src/tools/scm.js";
import { createMockClient, extractToolResponse, make404 } from "./helpers.js";

describe("SCM Tools", () => {
    let server: McpServer;
    let client: ReturnType<typeof createMockClient>;
    let toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<unknown>>;

    beforeEach(() => {
        server = new McpServer({ name: "test", version: "0.0.1" });
        client = createMockClient();
        toolHandlers = new Map();

        const originalTool = server.tool.bind(server);

        server.tool = ((...args: unknown[]) => {
            const name = args[0] as string;
            const handler = args[args.length - 1] as (args: Record<string, unknown>) => Promise<unknown>;

            toolHandlers.set(name, handler);

            return originalTool(...(args as Parameters<typeof originalTool>));
        }) as typeof server.tool;

        registerScmTools(server, client);
    });

    describe("getJobScm", () => {
        it("should extract SCM config from job", async() => {
            client.get.mockResolvedValueOnce({
                scm: {
                    userRemoteConfigs: [{ url: "https://github.com/org/repo.git" }],
                    branches: [{ name: "*/main" }]
                },
                actions: []
            });

            const handler = toolHandlers.get("getJobScm")!;
            const result = await handler({ jobFullName: "myJob" }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("COMPLETED");
            const configs = response.result as Array<{ uris: string[]; branches: string[] }>;

            expect(configs).toHaveLength(1);
            expect(configs[0].uris).toContain("https://github.com/org/repo.git");
            expect(configs[0].branches).toContain("*/main");
        });

        it("should handle 404", async() => {
            client.get.mockRejectedValueOnce(make404());

            const handler = toolHandlers.get("getJobScm")!;
            const result = await handler({ jobFullName: "nonexistent" }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("FAILED");
        });
    });

    describe("getBuildScm", () => {
        it("should extract SCM config from build actions", async() => {
            client.get.mockResolvedValueOnce({
                actions: [
                    {
                        remoteUrls: ["https://github.com/org/repo.git"],
                        lastBuiltRevision: {
                            SHA1: "abc123",
                            branch: [{ name: "origin/main", SHA1: "abc123" }]
                        }
                    }
                ]
            });

            const handler = toolHandlers.get("getBuildScm")!;
            const result = await handler({ jobFullName: "myJob", buildNumber: 1 }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("COMPLETED");
            const configs = response.result as Array<{ uris: string[]; branches: string[]; commit: string }>;

            expect(configs).toHaveLength(1);
            expect(configs[0].commit).toBe("abc123");
        });
    });

    describe("getBuildChangeSets", () => {
        it("should return change sets", async() => {
            const changeSets = [
                {
                    kind: "git",
                    items: [{ commitId: "abc", msg: "Fix bug", author: { fullName: "Dev" }}]
                }
            ];

            client.get.mockResolvedValueOnce({ changeSets });

            const handler = toolHandlers.get("getBuildChangeSets")!;
            const result = await handler({ jobFullName: "myJob", buildNumber: 1 }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("COMPLETED");
            expect(response.result).toEqual(changeSets);
        });
    });

    describe("findJobsWithScmUrl", () => {
        it("should find jobs matching SCM URL", async() => {
            client.get.mockResolvedValueOnce({
                jobs: [
                    {
                        name: "job1",
                        fullName: "job1",
                        url: "url1",
                        actions: [{ remoteUrls: ["https://github.com/org/repo.git"] }]
                    },
                    {
                        name: "job2",
                        fullName: "job2",
                        url: "url2",
                        actions: [{ remoteUrls: ["https://github.com/org/other.git"] }]
                    }
                ]
            });

            const handler = toolHandlers.get("findJobsWithScmUrl")!;
            const result = await handler({
                scmUrl: "https://github.com/org/repo",
                skip: 0,
                limit: 10
            }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("COMPLETED");
            const jobs = response.result as Array<{ name: string }>;

            expect(jobs).toHaveLength(1);
            expect(jobs[0].name).toBe("job1");
        });
    });
});
