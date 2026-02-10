import { describe, it, expect, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerTestTools } from "../../../src/tools/tests.js";
import { createMockClient, extractToolResponse, make404 } from "./helpers.js";

describe("Test Result Tools", () => {
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

        registerTestTools(server, client);
    });

    describe("getTestResults", () => {
        it("should return full test results", async() => {
            const testResult = {
                failCount: 1,
                passCount: 9,
                skipCount: 2,
                duration: 45.6,
                suites: [
                    {
                        name: "TestSuite",
                        cases: [
                            { name: "test1", className: "com.Test", status: "PASSED", duration: 1.2 },
                            { name: "test2", className: "com.Test", status: "FAILED", duration: 0.5, errorDetails: "assertion failed" }
                        ]
                    }
                ]
            };

            client.get.mockResolvedValueOnce(testResult);

            const handler = toolHandlers.get("getTestResults")!;
            const result = await handler({ jobFullName: "myJob", buildNumber: 1, onlyFailingTests: false }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("COMPLETED");
            const data = response.result as {
                TestResultAction: { failCount: number };
            };

            expect(data.TestResultAction.failCount).toBe(1);
        });

        it("should filter to failing tests only", async() => {
            const testResult = {
                failCount: 1,
                passCount: 2,
                skipCount: 0,
                suites: [
                    {
                        name: "Suite",
                        cases: [
                            { name: "pass1", className: "T", status: "PASSED" },
                            { name: "fail1", className: "T", status: "FAILED", errorDetails: "oops" },
                            { name: "pass2", className: "T", status: "PASSED" }
                        ]
                    }
                ]
            };

            client.get.mockResolvedValueOnce(testResult);

            const handler = toolHandlers.get("getTestResults")!;
            const result = await handler({ jobFullName: "myJob", buildNumber: 1, onlyFailingTests: true }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("COMPLETED");
            const data = response.result as { failingTests: Array<{ name: string }> };

            expect(data.failingTests).toHaveLength(1);
            expect(data.failingTests[0].name).toBe("fail1");
        });

        it("should handle 404 (no test report)", async() => {
            client.get.mockRejectedValueOnce(make404());

            const handler = toolHandlers.get("getTestResults")!;
            const result = await handler({ jobFullName: "myJob", buildNumber: 1, onlyFailingTests: false }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("COMPLETED");
            expect(response.message).toContain("No test results found");
        });
    });

    describe("getFlakyFailures", () => {
        it("should return flaky tests", async() => {
            const testResult = {
                failCount: 0,
                passCount: 3,
                skipCount: 0,
                suites: [
                    {
                        name: "Suite",
                        cases: [
                            { name: "stable", className: "T", status: "PASSED" },
                            { name: "flaky1", className: "T", status: "PASSED", flakyFailures: [{ message: "intermittent" }] },
                            { name: "stable2", className: "T", status: "PASSED" }
                        ]
                    }
                ]
            };

            client.get.mockResolvedValueOnce(testResult);

            const handler = toolHandlers.get("getFlakyFailures")!;
            const result = await handler({ jobFullName: "myJob", buildNumber: 1 }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("COMPLETED");
            const data = response.result as { TestResultWithFlakyFailures: Array<{ name: string }> };

            expect(data.TestResultWithFlakyFailures).toHaveLength(1);
            expect(data.TestResultWithFlakyFailures[0].name).toBe("flaky1");
        });

        it("should handle no flaky tests", async() => {
            const testResult = {
                failCount: 0,
                passCount: 2,
                skipCount: 0,
                suites: [
                    {
                        name: "Suite",
                        cases: [
                            { name: "test1", className: "T", status: "PASSED" },
                            { name: "test2", className: "T", status: "PASSED" }
                        ]
                    }
                ]
            };

            client.get.mockResolvedValueOnce(testResult);

            const handler = toolHandlers.get("getFlakyFailures")!;
            const result = await handler({ jobFullName: "myJob", buildNumber: 1 }) as ReturnType<typeof extractToolResponse>;
            const response = extractToolResponse(result as never);

            expect(response.status).toBe("COMPLETED");
            expect(response.message).toContain("No flaky failures");
        });
    });
});
