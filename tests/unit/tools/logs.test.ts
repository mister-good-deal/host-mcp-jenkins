import { describe, it, expect, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerLogTools } from "../../../src/tools/logs.js";
import { createMockClient, extractToolResponse, make404 } from "./helpers.js";

describe("Log Tools", () => {
    let server: McpServer;
    let client: ReturnType<typeof createMockClient>;
    let toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<unknown>>;

    beforeEach(() => {
        server = new McpServer({ name: "test", version: "0.0.1" });
        client = createMockClient();
        toolHandlers = new Map();

        const originalRegisterTool = server.registerTool.bind(server);

        server.registerTool = ((...args: unknown[]) => {
            const name = args[0] as string;
            const handler = args[args.length - 1] as (args: Record<string, unknown>) => Promise<unknown>;

            toolHandlers.set(name, handler);

            return originalRegisterTool(...(args as Parameters<typeof originalRegisterTool>));
        }) as typeof server.registerTool;

        registerLogTools(server, client);
    });

    describe("getBuildLog", () => {
        it("should return paginated log lines", async() => {
            const log = "Line 0\nLine 1\nLine 2\nLine 3\nLine 4\n";

            client.getText.mockResolvedValueOnce(log);

            const handler = toolHandlers.get("getBuildLog")!;
            const result = await handler({ jobFullName: "myJob", buildNumber: 1, skip: 1, limit: 2 }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("COMPLETED");
            const data = response.result as { lines: string[]; totalLines: number; startLine: number; endLine: number; hasMoreContent: boolean };

            expect(data.lines).toEqual(["Line 1", "Line 2"]);
            expect(data.totalLines).toBe(5);
            expect(data.startLine).toBe(1);
            expect(data.endLine).toBe(3);
            expect(data.hasMoreContent).toBe(true);
        });

        it("should handle last build", async() => {
            client.getText.mockResolvedValueOnce("Hello\n");

            const handler = toolHandlers.get("getBuildLog")!;

            await handler({ jobFullName: "myJob", limit: 100 });

            expect(client.getText).toHaveBeenCalledWith("/job/myJob/lastBuild/consoleText");
        });

        it("should handle 404", async() => {
            client.getText.mockRejectedValueOnce(make404());

            const handler = toolHandlers.get("getBuildLog")!;
            const result = await handler({ jobFullName: "nonexistent", buildNumber: 99 }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("FAILED");
            expect(response.message).toContain("not found");
        });
    });

    describe("getProgressiveBuildLog", () => {
        it("should return progressive log text with offset", async() => {
            const mockHeaders = new Headers({
                "X-Text-Size": "256",
                "X-More-Data": "true"
            });

            client.getTextWithHeaders.mockResolvedValueOnce({
                text: "Building step 1...\nBuilding step 2...\n",
                headers: mockHeaders
            });

            const handler = toolHandlers.get("getProgressiveBuildLog")!;
            const result = await handler({ jobFullName: "myJob", buildNumber: 1, start: 0 }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("COMPLETED");
            const data = response.result as { text: string; nextByteOffset: number; moreData: boolean };

            expect(data.text).toContain("Building step 1");
            expect(data.nextByteOffset).toBe(256);
            expect(data.moreData).toBe(true);
        });

        it("should report moreData false for completed builds", async() => {
            const mockHeaders = new Headers({
                "X-Text-Size": "100"
            });

            client.getTextWithHeaders.mockResolvedValueOnce({
                text: "Done\n",
                headers: mockHeaders
            });

            const handler = toolHandlers.get("getProgressiveBuildLog")!;
            const result = await handler({ jobFullName: "myJob", buildNumber: 1, start: 95 }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("COMPLETED");
            const data = response.result as { moreData: boolean };

            expect(data.moreData).toBe(false);
        });

        it("should handle 404", async() => {
            client.getTextWithHeaders.mockRejectedValueOnce(make404());

            const handler = toolHandlers.get("getProgressiveBuildLog")!;
            const result = await handler({ jobFullName: "nonexistent", buildNumber: 99 }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("FAILED");
            expect(response.message).toContain("not found");
        });
    });

    describe("searchBuildLog", () => {
        it("should find matching lines", async() => {
            const log = "Start build\nCompiling...\nERROR: something failed\nDone\nERROR: another issue\n";

            client.getText.mockResolvedValueOnce(log);

            const handler = toolHandlers.get("searchBuildLog")!;
            const result = await handler({
                jobFullName: "myJob",
                buildNumber: 1,
                pattern: "ERROR",
                maxMatches: 100,
                contextLines: 0,
                useRegex: false,
                ignoreCase: false
            }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("COMPLETED");
            const data = response.result as { matchCount: number; matches: Array<{ lineNumber: number; line: string }> };

            expect(data.matchCount).toBe(2);
            expect(data.matches).toHaveLength(2);
            expect(data.matches[0].lineNumber).toBe(3);
            expect(data.matches[0].line).toBe("ERROR: something failed");
        });

        it("should support regex search", async() => {
            const log = "Build #123 started\nTest passed\nBuild #456 completed\n";

            client.getText.mockResolvedValueOnce(log);

            const handler = toolHandlers.get("searchBuildLog")!;
            const result = await handler({
                jobFullName: "myJob",
                buildNumber: 1,
                pattern: "Build #\\d+",
                useRegex: true,
                ignoreCase: false,
                maxMatches: 100,
                contextLines: 0
            }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);
            const data = response.result as { matchCount: number };

            expect(data.matchCount).toBe(2);
        });

        it("should support case-insensitive search", async() => {
            const log = "Error found\nerror found\nERROR FOUND\n";

            client.getText.mockResolvedValueOnce(log);

            const handler = toolHandlers.get("searchBuildLog")!;
            const result = await handler({
                jobFullName: "myJob",
                buildNumber: 1,
                pattern: "error",
                ignoreCase: true,
                useRegex: false,
                maxMatches: 100,
                contextLines: 0
            }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);
            const data = response.result as { matchCount: number };

            expect(data.matchCount).toBe(3);
        });

        it("should include context lines", async() => {
            const log = "Line 1\nLine 2\nMATCH\nLine 4\nLine 5\n";

            client.getText.mockResolvedValueOnce(log);

            const handler = toolHandlers.get("searchBuildLog")!;
            const result = await handler({
                jobFullName: "myJob",
                buildNumber: 1,
                pattern: "MATCH",
                contextLines: 1,
                useRegex: false,
                ignoreCase: false,
                maxMatches: 100
            }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);
            const data = response.result as { matches: Array<{ contextBefore: string[]; contextAfter: string[] }> };

            expect(data.matches[0].contextBefore).toEqual(["Line 2"]);
            expect(data.matches[0].contextAfter).toEqual(["Line 4"]);
        });
    });
});
