/**
 * Output schema definitions for all MCP tools.
 *
 * Each schema describes the JSON structure returned by the tool inside
 * the MCP text content block: `{ status, message, result }`.
 *
 * These schemas are meant to be wired into `registerTool({ outputSchema })`.
 */
import { z } from "zod";

// ── Base envelope ────────────────────────────────────────────────────────

export const ToolResponseSchema = z.object({
    status: z.enum(["COMPLETED", "FAILED"]).describe("Whether the tool call succeeded"),
    message: z.string().describe("Human-readable status message"),
    result: z.unknown().describe("Tool-specific result payload")
});

// ── Core tools ───────────────────────────────────────────────────────────

export const getJobOutput = ToolResponseSchema.describe("Jenkins job details");

export const getJobsOutput = ToolResponseSchema.extend({
    result: z.array(z.object({
        name: z.string(),
        fullName: z.string().optional(),
        url: z.string(),
        color: z.string().optional(),
        displayName: z.string().optional(),
        description: z.string().optional()
    })).describe("Paginated list of jobs sorted by name")
}).describe("Paginated Jenkins jobs");

export const getBuildOutput = ToolResponseSchema.describe("Jenkins build details");

export const triggerBuildOutput = ToolResponseSchema.describe("Build trigger result with queue item");

export const updateBuildOutput = ToolResponseSchema.describe("Build update confirmation");

export const whoAmIOutput = ToolResponseSchema.extend({
    result: z.object({
        fullName: z.string()
    }).describe("Authenticated user info")
}).describe("Current Jenkins user");

export const getStatusOutput = ToolResponseSchema.extend({
    result: z.object({
        "Quiet Mode": z.boolean(),
        "Full Queue Size": z.number(),
        "Buildable Queue Size": z.number(),
        "Available executors (any label)": z.number(),
        "Root URL Status": z.string()
    }).describe("Jenkins instance health metrics")
}).describe("Jenkins instance status");

export const getQueueItemOutput = ToolResponseSchema.describe("Jenkins queue item details");

// ── Log tools ────────────────────────────────────────────────────────────

export const getBuildLogOutput = ToolResponseSchema.extend({
    result: z.object({
        lines: z.array(z.string()).describe("Log lines in the requested range"),
        totalLines: z.number().describe("Total number of lines in the full log"),
        startLine: z.number().describe("0-based start line index"),
        endLine: z.number().describe("0-based exclusive end line index"),
        hasMoreContent: z.boolean().describe("Whether there are more lines beyond endLine")
    }).describe("Paginated build log output")
}).describe("Build log with pagination");

export const searchBuildLogOutput = ToolResponseSchema.extend({
    result: z.object({
        pattern: z.string(),
        useRegex: z.boolean(),
        ignoreCase: z.boolean(),
        matchCount: z.number().describe("Total number of matches found"),
        hasMoreMatches: z.boolean(),
        totalLines: z.number(),
        matches: z.array(z.object({
            lineNumber: z.number().describe("1-indexed line number"),
            line: z.string(),
            contextBefore: z.array(z.string()),
            contextAfter: z.array(z.string())
        }))
    }).describe("Log search results with context")
}).describe("Build log search results");

// ── SCM tools ────────────────────────────────────────────────────────────

const GitScmConfigSchema = z.object({
    uris: z.array(z.string()).describe("Remote repository URLs"),
    branches: z.array(z.string()).describe("Branch specs"),
    commit: z.string().optional().describe("Last built commit SHA")
});

export const getJobScmOutput = ToolResponseSchema.extend({
    result: z.array(GitScmConfigSchema).describe("SCM configurations found for the job")
}).describe("Job SCM configurations");

export const getBuildScmOutput = ToolResponseSchema.extend({
    result: z.array(GitScmConfigSchema).describe("SCM configurations from build actions")
}).describe("Build SCM configurations");

export const getBuildChangeSetsOutput = ToolResponseSchema.describe("Build change sets");

export const findJobsWithScmUrlOutput = ToolResponseSchema.extend({
    result: z.array(z.object({
        name: z.string(),
        fullName: z.string().optional(),
        url: z.string()
    })).describe("Jobs matching the specified SCM URL")
}).describe("Jobs using the given SCM URL");

// ── Test tools ───────────────────────────────────────────────────────────

export const getTestResultsOutput = ToolResponseSchema.describe("Test results for a build");

export const getFlakyFailuresOutput = ToolResponseSchema.describe("Flaky test failures for a build");

/**
 * Map of tool name → output schema, for easy wiring into registerTool.
 */
export const OUTPUT_SCHEMAS: Record<string, z.ZodType> = {
    getJob: getJobOutput,
    getJobs: getJobsOutput,
    getBuild: getBuildOutput,
    triggerBuild: triggerBuildOutput,
    updateBuild: updateBuildOutput,
    whoAmI: whoAmIOutput,
    getStatus: getStatusOutput,
    getQueueItem: getQueueItemOutput,
    getBuildLog: getBuildLogOutput,
    searchBuildLog: searchBuildLogOutput,
    getJobScm: getJobScmOutput,
    getBuildScm: getBuildScmOutput,
    getBuildChangeSets: getBuildChangeSetsOutput,
    findJobsWithScmUrl: findJobsWithScmUrlOutput,
    getTestResults: getTestResultsOutput,
    getFlakyFailures: getFlakyFailuresOutput
};
