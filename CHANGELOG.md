# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-02-10

### Changed

- Switched npm publish to OIDC trusted publisher (no more long-lived tokens)
- Fixed release workflow version extraction

## [0.2.0] - 2026-02-10

### Breaking Changes

- Migrated from deprecated `server.tool()` to `server.registerTool()` API (#2)
- npm package renamed to `@mister-good-deal/host-mcp-jenkins`

### Added

- **Progressive log tool**: `getProgressiveBuildLog` for incremental build log retrieval via Jenkins progressive text API (#8)
- **HTTP transport**: Streamable HTTP transport via `--transport http` and `--port` options (#12)
- **Output schemas**: Zod-based response schemas for all MCP tools (#10)
- **HTTP retry**: Exponential backoff with jitter for transient errors (429/5xx), configurable via `--max-retries` and `--retry-delay` (#9)
- **CD workflow**: Automatic GitHub Release + npm publish on push to main (#3)
- **Integration tests**: Docker-based smoke tests with real Jenkins instance (#4)
- Centralized version string from `package.json` (#6)
- MCP tool annotations (`readOnlyHint`) for all tools (#2)

### Changed

- Optimized `findJobsWithScmUrl` with recursive tree query (3-level deep) and early termination (#11)
- Graceful error handling: all tool handlers now return structured errors instead of throwing (#7)

### Fixed

- Renamed `CHANEGELOG.md` → `CHANGELOG.md` and added v0.1.0 release entry (#5)

## [0.1.0] - 2025-02-10

### Added

- Initial release with full parity (16 MCP tools) with the [Jenkins MCP Server Plugin](https://github.com/jenkinsci/mcp-server-plugin)
- **Core tools**: `getJob`, `getJobs`, `getBuild`, `triggerBuild`, `updateBuild`, `whoAmI`, `getStatus`, `getQueueItem`
- **Build log tools**: `getBuildLog`, `searchBuildLog`
- **SCM tools**: `getJobScm`, `getBuildScm`, `getBuildChangeSets`, `findJobsWithScmUrl`
- **Test result tools**: `getTestResults`, `getFlakyFailures`
- Configuration via CLI arguments and environment variables
- `--insecure` flag for skipping TLS certificate verification
- Configurable HTTP timeout (`--timeout`)
- Structured `ToolResponse` envelope (`COMPLETED` / `FAILED`) matching the Jenkins plugin format
- stdio transport for local MCP client integration (Claude Desktop, VS Code, Cursor)
- Unit tests with Jest for all tools, client, config, and utility functions
- CI pipeline with GitHub Actions (lint, build, test on Node 20 & 22)
- Integration test scaffold with Jenkins Docker service container
