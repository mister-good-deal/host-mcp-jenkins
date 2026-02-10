# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
