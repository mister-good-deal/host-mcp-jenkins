import { z } from "zod";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { JenkinsClient } from "../jenkins/client.js";
import { JenkinsClientError } from "../jenkins/client.js";
import { jobFullNameToPath } from "../jenkins/utils.js";
import { getLogger } from "../logger.js";
import { toMcpResult, toolNotFound, toolSuccess } from "../response.js";

interface BuildLogResponse {
    hasMoreContent: boolean;
    lines: string[];
    totalLines: number;
    startLine: number;
    endLine: number;
}

interface SearchMatch {
    lineNumber: number;
    line: string;
    contextBefore: string[];
    contextAfter: string[];
}

interface SearchLogResponse {
    pattern: string;
    useRegex: boolean;
    ignoreCase: boolean;
    matchCount: number;
    hasMoreMatches: boolean;
    totalLines: number;
    matches: SearchMatch[];
}

const MAX_LOG_LINES = 10000;
const MAX_SEARCH_MATCHES = 1000;
const MAX_CONTEXT_LINES = 10;

export function registerLogTools(server: McpServer, client: JenkinsClient): void {
    const logger = getLogger();

    // ── getBuildLog ──────────────────────────────────────────────────────
    server.registerTool(
        "getBuildLog",
        {
            description: "Retrieves some log lines with pagination for a specific build or the last build",
            inputSchema: {
                jobFullName: z.string().describe("Full name of the Jenkins job"),
                buildNumber: z.number().int().optional().describe("Build number (omit for last build)"),
                skip: z.number().int().optional().describe("Number of lines to skip (negative = from end)"),
                limit: z.number().int().default(100).optional().
                    describe("Number of lines to return (positive=from start, negative=from end, default 100)")
            },
            annotations: { readOnlyHint: true }
        },
        async({ jobFullName, buildNumber, skip, limit = 100 }) => {
            logger.debug(`getBuildLog: ${jobFullName}#${buildNumber ?? "last"}, skip=${skip}, limit=${limit}`);

            try {
                const buildPath = buildNumber ? `/${buildNumber}` : "/lastBuild";
                const path = `${jobFullNameToPath(jobFullName)}${buildPath}/consoleText`;
                const rawLog = await client.getText(path);

                const allLines = rawLog.split("\n");

                // Remove trailing empty line from split
                if (allLines.length > 0 && allLines[allLines.length - 1] === "") {
                    allLines.pop();
                }

                const totalLines = allLines.length;
                const effectiveLimit = Math.min(Math.abs(limit), MAX_LOG_LINES);

                let startLine: number;
                let endLine: number;

                if (skip !== undefined && skip < 0) {
                    // Skip from end
                    endLine = Math.max(0, totalLines + skip);
                    startLine = Math.max(0, endLine - effectiveLimit);
                } else {
                    startLine = skip ?? 0;
                    endLine = Math.min(totalLines, startLine + effectiveLimit);
                }

                const lines = allLines.slice(startLine, endLine);
                const hasMoreContent = endLine < totalLines;

                const response: BuildLogResponse = {
                    hasMoreContent,
                    lines,
                    totalLines,
                    startLine,
                    endLine
                };

                return toMcpResult(toolSuccess(response));
            } catch (error) {
                if (error instanceof JenkinsClientError && error.statusCode === 404) {
                    const id = buildNumber ? `${jobFullName}#${buildNumber}` : `${jobFullName} (last build)`;

                    return toMcpResult(toolNotFound("Build", id));
                }

                throw error;
            }
        }
    );

    // ── searchBuildLog ───────────────────────────────────────────────────
    server.registerTool(
        "searchBuildLog",
        {
            description: "Search for log lines matching a pattern in a specific build or the last build",
            inputSchema: {
                jobFullName: z.string().describe("Full name of the Jenkins job"),
                buildNumber: z.number().int().optional().describe("Build number (omit for last build)"),
                pattern: z.string().describe("Search pattern (string or regex)"),
                useRegex: z.boolean().default(false).optional().describe("Treat pattern as regex"),
                ignoreCase: z.boolean().default(false).optional().describe("Case-insensitive search"),
                maxMatches: z.number().int().min(1).max(MAX_SEARCH_MATCHES).
                    default(100).
                    optional().
                    describe("Maximum number of matches to return (max 1000)"),
                contextLines: z.number().int().min(0).max(MAX_CONTEXT_LINES).
                    default(0).
                    optional().
                    describe("Number of context lines before and after each match (max 10)")
            },
            annotations: { readOnlyHint: true }
        },
        async({ jobFullName, buildNumber, pattern, useRegex = false, ignoreCase = false, maxMatches = 100, contextLines = 0 }) => {
            logger.debug(`searchBuildLog: ${jobFullName}#${buildNumber ?? "last"}, pattern="${pattern}"`);

            try {
                const buildPath = buildNumber ? `/${buildNumber}` : "/lastBuild";
                const path = `${jobFullNameToPath(jobFullName)}${buildPath}/consoleText`;
                const rawLog = await client.getText(path);

                const allLines = rawLog.split("\n");

                if (allLines.length > 0 && allLines[allLines.length - 1] === "") {
                    allLines.pop();
                }

                const totalLines = allLines.length;
                const flags = ignoreCase ? "i" : "";
                const regex = useRegex
                    ? new RegExp(pattern, flags)
                    : new RegExp(escapeRegex(pattern), flags);

                const matches: SearchMatch[] = [];
                let matchCount = 0;

                for (let i = 0; i < totalLines; i++) {
                    if (regex.test(allLines[i])) {
                        matchCount++;

                        if (matches.length < maxMatches) {
                            const ctxStart = Math.max(0, i - contextLines);
                            const ctxEnd = Math.min(totalLines, i + contextLines + 1);

                            matches.push({
                                lineNumber: i + 1, // 1-indexed
                                line: allLines[i],
                                contextBefore: allLines.slice(ctxStart, i),
                                contextAfter: allLines.slice(i + 1, ctxEnd)
                            });
                        }
                    }
                }

                const response: SearchLogResponse = {
                    pattern,
                    useRegex,
                    ignoreCase,
                    matchCount,
                    hasMoreMatches: matchCount > maxMatches,
                    totalLines,
                    matches
                };

                return toMcpResult(toolSuccess(response));
            } catch (error) {
                if (error instanceof JenkinsClientError && error.statusCode === 404) {
                    const id = buildNumber ? `${jobFullName}#${buildNumber}` : `${jobFullName} (last build)`;

                    return toMcpResult(toolNotFound("Build", id));
                }

                throw error;
            }
        }
    );
}

/**
 * Escape special regex characters in a string for use as a literal pattern.
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
