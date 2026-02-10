import { describe, it, expect, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerCoreTools } from "../../../src/tools/core.js";
import { createMockClient, extractToolResponse, make404 } from "./helpers.js";

describe("Core Tools", () => {
    let server: McpServer;
    let client: ReturnType<typeof createMockClient>;
    let toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<unknown>>;

    beforeEach(() => {
        server = new McpServer({ name: "test", version: "0.0.1" });
        client = createMockClient();
        toolHandlers = new Map();

        // Intercept tool registration to capture handlers
        const originalRegisterTool = server.registerTool.bind(server);

        server.registerTool = ((...args: unknown[]) => {
            const name = args[0] as string;
            // The handler is always the last argument
            const handler = args[args.length - 1] as (args: Record<string, unknown>) => Promise<unknown>;

            toolHandlers.set(name, handler);

            return originalRegisterTool(...(args as Parameters<typeof originalRegisterTool>));
        }) as typeof server.registerTool;

        registerCoreTools(server, client);
    });

    describe("getJob", () => {
        it("should return a job", async() => {
            const mockJob = { name: "testJob", url: "https://jenkins/job/testJob/", color: "blue" };

            client.get.mockResolvedValueOnce(mockJob);

            const handler = toolHandlers.get("getJob")!;
            const result = await handler({ jobFullName: "testJob" }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("COMPLETED");
            expect(response.result).toEqual(mockJob);
            expect(client.get).toHaveBeenCalledWith("/job/testJob/api/json", { tree: undefined });
        });

        it("should handle 404 for non-existent job", async() => {
            client.get.mockRejectedValueOnce(make404());

            const handler = toolHandlers.get("getJob")!;
            const result = await handler({ jobFullName: "nonexistent" }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("FAILED");
            expect(response.message).toContain("not found");
        });

        it("should forward tree parameter", async() => {
            client.get.mockResolvedValueOnce({ name: "test" });

            const handler = toolHandlers.get("getJob")!;

            await handler({ jobFullName: "test", tree: "name,color" });

            expect(client.get).toHaveBeenCalledWith("/job/test/api/json", { tree: "name,color" });
        });
    });

    describe("getJobs", () => {
        it("should return paginated jobs sorted by name", async() => {
            const mockJobs = {
                jobs: [
                    { name: "charlie", url: "url3" },
                    { name: "alpha", url: "url1" },
                    { name: "bravo", url: "url2" }
                ]
            };

            client.get.mockResolvedValueOnce(mockJobs);

            const handler = toolHandlers.get("getJobs")!;
            const result = await handler({ skip: 0, limit: 2 }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("COMPLETED");
            const jobs = response.result as Array<{ name: string }>;

            expect(jobs).toHaveLength(2);
            expect(jobs[0].name).toBe("alpha");
            expect(jobs[1].name).toBe("bravo");
        });
    });

    describe("getBuild", () => {
        it("should return a specific build", async() => {
            const mockBuild = { number: 42, result: "SUCCESS", url: "url" };

            client.get.mockResolvedValueOnce(mockBuild);

            const handler = toolHandlers.get("getBuild")!;
            const result = await handler({ jobFullName: "myJob", buildNumber: 42 }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("COMPLETED");
            expect(response.result).toEqual(mockBuild);
            expect(client.get).toHaveBeenCalledWith("/job/myJob/42/api/json", { tree: undefined });
        });

        it("should return last build when no number specified", async() => {
            const mockBuild = { number: 99, result: "FAILURE" };

            client.get.mockResolvedValueOnce(mockBuild);

            const handler = toolHandlers.get("getBuild")!;

            await handler({ jobFullName: "myJob" });

            expect(client.get).toHaveBeenCalledWith("/job/myJob/lastBuild/api/json", { tree: undefined });
        });
    });

    describe("whoAmI", () => {
        it("should return the current user", async() => {
            client.get.mockResolvedValueOnce({ fullName: "Admin User", id: "admin" });

            const handler = toolHandlers.get("whoAmI")!;
            const result = await handler({}) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("COMPLETED");
            expect(response.result).toEqual({ fullName: "Admin User" });
        });
    });

    describe("getStatus", () => {
        it("should aggregate Jenkins status", async() => {
            client.get.
                mockResolvedValueOnce({ quietingDown: false, url: "https://jenkins.example.com/" }).
                mockResolvedValueOnce({
                    busyExecutors: 2,
                    totalExecutors: 10,
                    computer: [
                        { displayName: "master", idle: false, offline: false, temporarilyOffline: false, numExecutors: 4 },
                        { displayName: "agent1", idle: true, offline: false, temporarilyOffline: false, numExecutors: 6 }
                    ]
                }).
                mockResolvedValueOnce({
                    items: [
                        { id: 1, buildable: true },
                        { id: 2, buildable: false }
                    ]
                });

            const handler = toolHandlers.get("getStatus")!;
            const result = await handler({}) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("COMPLETED");
            const status = response.result as Record<string, unknown>;

            expect(status["Quiet Mode"]).toBe(false);
            expect(status["Full Queue Size"]).toBe(2);
            expect(status["Buildable Queue Size"]).toBe(1);
            expect(status["Available executors (any label)"]).toBe(8); // 10 - 2
            expect(status["Root URL Status"]).toBe("configured");
        });
    });

    describe("triggerBuild", () => {
        it("should trigger a simple build", async() => {
            const queueItem = { id: 42, url: "queue/item/42/" };

            client.post.mockResolvedValueOnce({
                data: null,
                location: "https://jenkins.example.com/queue/item/42/"
            });
            client.get.mockResolvedValueOnce(queueItem);

            const handler = toolHandlers.get("triggerBuild")!;
            const result = await handler({ jobFullName: "myJob" }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("COMPLETED");
            expect(response.message).toContain("triggered");
            expect(client.post).toHaveBeenCalledWith("/job/myJob/build");
        });
    });
});
