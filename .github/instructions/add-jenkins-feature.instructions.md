# Adding a New Jenkins API Feature

Procedure for adding a new MCP tool that maps to a specific Jenkins REST API endpoint.

## Prerequisites

- Identify the target Jenkins REST API endpoint (e.g., `GET /job/{name}/api/json`)
- Determine the HTTP method (`GET`, `POST`) and expected response format
- Check the Jenkins API documentation:
  - Remote Access API: https://www.jenkins.io/doc/book/using/remote-access-api/
  - Jenkins Javadoc: https://javadoc.jenkins.io/
- Determine which tool category the feature belongs to:
  - **core** (`src/tools/core.ts`) — Jobs, builds, queue, triggers, status
  - **logs** (`src/tools/logs.ts`) — Build console output and log search
  - **scm** (`src/tools/scm.ts`) — Source control configurations and change sets
  - **tests** (`src/tools/tests.ts`) — Test results and flaky test analysis

## Step-by-Step Procedure

### 1. Define TypeScript Types

Add response interfaces in `src/jenkins/types.ts` for the Jenkins API response structure.

```typescript
// Example: Adding a new type for a Jenkins plugin API response
export interface JenkinsPluginInfo {
    shortName: string;
    longName: string;
    version: string;
    active: boolean;
    enabled: boolean;
    url?: string;
    [key: string]: unknown; // Allow extra fields from Jenkins
}
```

> **Tip:** Use `[key: string]: unknown` on interfaces to handle extra fields Jenkins may return.

### 2. Register the Tool

Add the tool registration in the appropriate `src/tools/{category}.ts` file. Follow the existing pattern:

```typescript
/*
 * ── getPlugins ──────────────────────────────────────────────────────
 * Jenkins API: GET /pluginManager/api/json
 * @see https://javadoc.jenkins.io/hudson/PluginManager.html
 */
server.registerTool(
    "getPlugins",
    {
        description: "Get a list of installed Jenkins plugins",
        inputSchema: {
            // Define input parameters using Zod schemas
            active: z.boolean().default(true).optional()
                .describe("Filter to only active plugins")
        },
        annotations: { readOnlyHint: true } // Set to false for write operations
    },
    async({ active = true }) => {
        logger.debug(`getPlugins: active=${active}`);

        try {
            const data = await client.get<JenkinsPluginList>(
                "/pluginManager/api/json",
                { tree: "plugins[shortName,longName,version,active,enabled,url]" }
            );

            const plugins = active
                ? data.plugins.filter(p => p.active)
                : data.plugins;

            return toMcpResult(toolSuccess(plugins));
        } catch (error) {
            if (error instanceof JenkinsClientError && error.statusCode === 404) {
                return toMcpResult(toolNotFound("Plugin Manager", ""));
            }

            return toMcpResult(toolError(error));
        }
    }
);
```

**Key points:**
- Always add a block comment above `server.registerTool()` with:
  - The section header (e.g., `── toolName ──`)
  - The Jenkins API endpoint pattern (e.g., `Jenkins API: GET /pluginManager/api/json`)
  - A `@see` link to the relevant documentation URL
- Use `readOnlyHint: true` for GET endpoints, `false` for POST/PUT/DELETE
- Use the `tree` query parameter to limit response fields for better performance
- Handle `404` errors specifically with `toolNotFound()`
- Wrap unexpected errors with `toolError(error)`

### 3. Add Output Schema

Add a Zod output schema in `src/tools/output-schemas.ts`:

```typescript
export const getPluginsOutput = ToolResponseSchema.extend({
    result: z.array(z.object({
        shortName: z.string(),
        longName: z.string(),
        version: z.string(),
        active: z.boolean()
    })).describe("List of installed plugins")
}).describe("Installed Jenkins plugins");
```

Then add it to the `OUTPUT_SCHEMAS` map at the bottom of the file:

```typescript
export const OUTPUT_SCHEMAS: Record<string, z.ZodType> = {
    // ... existing entries
    getPlugins: getPluginsOutput,
};
```

### 4. Update Tool Count in Server

Update the tool count in `src/server.ts` if it is hardcoded:

```typescript
logger.info("All 18 MCP tools registered successfully"); // Was 17
```

### 5. Add Unit Tests

Create or update the test file in `tests/unit/tools/{category}.test.ts`. Follow the existing mock pattern:

```typescript
describe("getPlugins", () => {
    it("should return active plugins", async () => {
        const mockPlugins = {
            plugins: [
                { shortName: "git", longName: "Git plugin", version: "5.0", active: true, enabled: true },
                { shortName: "old-plugin", longName: "Old Plugin", version: "1.0", active: false, enabled: false }
            ]
        };

        mockGet.mockResolvedValueOnce(mockPlugins);

        const result = await callTool("getPlugins", { active: true });

        expect(result.status).toBe("COMPLETED");
        expect(result.result).toHaveLength(1);
        expect(result.result[0].shortName).toBe("git");
    });
});
```

### 6. Update Documentation

- Add the new tool to the tools table in `README.md`
- Add a changelog entry in `CHANGELOG.md`

## Jenkins Client Methods Reference

The `JenkinsClient` (`src/jenkins/client.ts`) provides these HTTP methods:

| Method | Usage | Returns |
|---|---|---|
| `client.get<T>(path, query?)` | GET JSON API | Parsed JSON object |
| `client.getText(path, query?)` | GET raw text (logs) | Raw string |
| `client.getTextWithHeaders(path, query?)` | GET text with headers | `{ text, headers }` |
| `client.post<T>(path, body?, query?)` | POST with optional body | `{ data, location }` |
| `client.head(path)` | HEAD request | `{ status, headers }` |

## Validation Checklist

- [ ] TypeScript interfaces defined in `src/jenkins/types.ts`
- [ ] Tool registered with documentation comment linking to Jenkins API docs
- [ ] Output schema added in `src/tools/output-schemas.ts`
- [ ] Tool count updated in `src/server.ts`
- [ ] Unit tests added in `tests/unit/tools/`
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] `README.md` updated with new tool entry
- [ ] `CHANGELOG.md` updated
