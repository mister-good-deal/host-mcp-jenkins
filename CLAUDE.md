# CLAUDE.md

Project context and conventions for AI assistants working on this codebase.

## Project Overview

`@mister-good-deal/host-mcp-jenkins` — A local MCP (Model Context Protocol) server for Jenkins that replicates the Jenkins MCP Server Plugin by calling Jenkins REST API over HTTP. No plugin installation required on the Jenkins instance.

**Stack:** TypeScript 5.7+, Node.js >=20, pnpm 10.29.2, ESM modules, MCP SDK v1.26.0

## Commands

```bash
pnpm install              # Install dependencies
pnpm run build            # Compile TypeScript (tsc)
pnpm run lint             # ESLint check
pnpm run lint:fix         # ESLint auto-fix
pnpm run test             # Unit tests (Jest, 67 tests)
pnpm run test:integration # Integration tests (requires Docker with Jenkins)
pnpm run dev              # Run in dev mode (tsx)
```

## Architecture

```
src/
  index.ts          # Entry point — CLI parsing, transport setup (stdio/http)
  config.ts         # CLI arguments + env vars via commander
  server.ts         # McpServer creation, registers all tool groups
  logger.ts         # Winston logger (levels: debug|info|warn|error|silent)
  response.ts       # ToolResponse envelope helpers (toolSuccess/toolFailure/toolNotFound)
  jenkins/
    client.ts       # JenkinsClient — HTTP client with retry, auth, error handling
    types.ts        # Jenkins API type definitions
    utils.ts        # Shared utilities (pagination, tree parameter building)
  tools/
    core.ts         # 8 tools: getJob, getJobs, getBuild, triggerBuild, updateBuild, whoAmI, getStatus, getQueueItem
    logs.ts         # 3 tools: getBuildLog, getProgressiveBuildLog, searchBuildLog
    scm.ts          # 4 tools: getJobScm, getBuildScm, getBuildChangeSets, findJobsWithScmUrl
    tests.ts        # 2 tools: getTestResults, getFlakyFailures
tests/
  unit/
    setup.ts        # Global test setup — silences logger
    tools/helpers.ts # Mock JenkinsClient factory, error helpers
```

### Key Patterns

- **Tool registration:** Uses `server.registerTool()` with Zod input/output schemas
- **Response envelope:** All tools return `{ status: "COMPLETED"|"FAILED", message, result }` via helpers in `response.ts`
- **Error handling:** Tools catch `JenkinsClientError` and return `toolNotFound()` for 404s, `toolFailure()` for others — never throw
- **HTTP retry:** `JenkinsClient` uses exponential backoff with jitter for 429/5xx errors
- **ESM imports:** Always use `.js` extension in relative imports (`./config.js`, not `./config`)

## Code Style

- **4-space indentation**, double quotes, semicolons always
- **No braces on single-statement bodies** (`curly: "multi"` rule): `if (x) return y;`
- **1TBS brace style** with single-line blocks allowed
- **Blank lines** before `return`, `try`, `throw`, `for`, `while`, `class` statements
- **Consistent type imports:** `import type { Foo }` for type-only imports
- **Unused vars:** Prefix with `_` (e.g., `_unused`)
- **No trailing spaces, no tabs**, max 1 consecutive blank line
- Run `pnpm run lint:fix` to auto-format

## Testing

- **Framework:** Jest 29 with ts-jest ESM preset
- **Test location:** `tests/unit/` mirrors `src/` structure
- **Logger is silenced** globally via `tests/unit/setup.ts`
- **Mock pattern:** Tests create a `jest.Mocked<JenkinsClient>` via `createMockClient()` from `helpers.ts`
- **ESM requirement:** Tests need `--experimental-vm-modules` (handled automatically by npm scripts)

## CI/CD

- **CI** (`ci.yml`): Lint + build + test on Node 20 and 22, triggers on push/PR to main
- **Integration** (`integration.yml`): Docker-based smoke tests with real Jenkins instance
- **Release** (`release.yml`): On push to main — runs CI, creates git tag + GitHub Release, publishes to npm via OIDC trusted publisher (no tokens)
- **Versioning:** Manual bump in `package.json`, automatic tag creation from version field

## Git Conventions

- **Commit messages:** Conventional Commits (`feat:`, `fix:`, `style:`, `test:`, `docs:`, `ci:`)
- **Author:** Romain Laneuville <romain.laneuville@hotmail.fr>
- **Branch strategy:** `main` for releases, `dev` for work-in-progress
