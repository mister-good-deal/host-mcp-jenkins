import { z } from "zod";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { JenkinsClient } from "../jenkins/client.js";
import { JenkinsClientError } from "../jenkins/client.js";
import type { JenkinsTestCase, JenkinsTestResult } from "../jenkins/types.js";
import { jobFullNameToPath } from "../jenkins/utils.js";
import { getLogger } from "../logger.js";
import { toMcpResult, toolEmpty, toolError, toolSuccess } from "../response.js";

export function registerTestTools(server: McpServer, client: JenkinsClient): void {
    const logger = getLogger();

    // ── getTestResults ───────────────────────────────────────────────────
    server.registerTool(
        "getTestResults",
        {
            description: "Retrieves the test results associated to a Jenkins build",
            inputSchema: {
                jobFullName: z.string().describe("Full name of the Jenkins job"),
                buildNumber: z.number().int().optional().describe("Build number (omit for last build)"),
                onlyFailingTests: z.boolean().default(false).optional().
                    describe("If true, only return failing tests")
            },
            annotations: { readOnlyHint: true }
        },
        async({ jobFullName, buildNumber, onlyFailingTests = false }) => {
            logger.debug(`getTestResults: ${jobFullName}#${buildNumber ?? "last"}, failing=${onlyFailingTests}`);

            try {
                const buildPath = buildNumber ? `/${buildNumber}` : "/lastBuild";
                const path = `${jobFullNameToPath(jobFullName)}${buildPath}/testReport/api/json`;
                const testResult = await client.get<JenkinsTestResult>(path);

                if (onlyFailingTests) {
                    const failingTests = extractFailingTests(testResult);

                    if (failingTests.length === 0) return toMcpResult(toolEmpty("No failing tests found."));

                    return toMcpResult(toolSuccess({
                        TestResultAction: {
                            failCount: testResult.failCount,
                            passCount: testResult.passCount,
                            skipCount: testResult.skipCount
                        },
                        failingTests
                    }));
                }

                return toMcpResult(toolSuccess({
                    TestResultAction: {
                        failCount: testResult.failCount,
                        passCount: testResult.passCount,
                        skipCount: testResult.skipCount,
                        duration: testResult.duration
                    },
                    TestResult: testResult
                }));
            } catch (error) {
                if (error instanceof JenkinsClientError && error.statusCode === 404) {
                    const id = buildNumber ? `${jobFullName}#${buildNumber}` : `${jobFullName} (last build)`;

                    // 404 on testReport means either build not found or no test results
                    return toMcpResult(toolEmpty(`No test results found for build '${id}'. The build may not have any test report or may not exist.`));
                }

                return toMcpResult(toolError(error));
            }
        }
    );

    // ── getFlakyFailures ─────────────────────────────────────────────────
    server.registerTool(
        "getFlakyFailures",
        {
            description: "Retrieves the flaky failures associated to a Jenkins build if any found",
            inputSchema: {
                jobFullName: z.string().describe("Full name of the Jenkins job"),
                buildNumber: z.number().int().optional().describe("Build number (omit for last build)")
            },
            annotations: { readOnlyHint: true }
        },
        async({ jobFullName, buildNumber }) => {
            logger.debug(`getFlakyFailures: ${jobFullName}#${buildNumber ?? "last"}`);

            try {
                const buildPath = buildNumber ? `/${buildNumber}` : "/lastBuild";
                const path = `${jobFullNameToPath(jobFullName)}${buildPath}/testReport/api/json`;
                const testResult = await client.get<JenkinsTestResult>(path);

                const flakyTests = extractFlakyTests(testResult);

                if (flakyTests.length === 0) return toMcpResult(toolEmpty("No flaky failures found."));

                return toMcpResult(toolSuccess({
                    TestResultAction: {
                        failCount: testResult.failCount,
                        passCount: testResult.passCount,
                        skipCount: testResult.skipCount
                    },
                    TestResultWithFlakyFailures: flakyTests
                }));
            } catch (error) {
                if (error instanceof JenkinsClientError && error.statusCode === 404) {
                    const id = buildNumber ? `${jobFullName}#${buildNumber}` : `${jobFullName} (last build)`;

                    return toMcpResult(toolEmpty(`No test results found for build '${id}'.`));
                }

                return toMcpResult(toolError(error));
            }
        }
    );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function extractFailingTests(testResult: JenkinsTestResult): JenkinsTestCase[] {
    const failing: JenkinsTestCase[] = [];

    if (!testResult.suites) return failing;

    for (const suite of testResult.suites) for (const testCase of suite.cases) if (testCase.status === "FAILED" || testCase.status === "REGRESSION") failing.push(testCase);

    return failing;
}

function extractFlakyTests(testResult: JenkinsTestResult): JenkinsTestCase[] {
    const flaky: JenkinsTestCase[] = [];

    if (!testResult.suites) return flaky;

    for (const suite of testResult.suites) for (const testCase of suite.cases) {
        const tc = testCase as unknown as Record<string, unknown>; /* flaky check */

        if (tc.flakyFailures && Array.isArray(tc.flakyFailures) && (tc.flakyFailures as unknown[]).length > 0) flaky.push(testCase);
    }

    return flaky;
}
