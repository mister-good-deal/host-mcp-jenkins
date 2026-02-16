# host-mcp-jenkins

A local MCP (Model Context Protocol) server for Jenkins that replicates the [Jenkins MCP Server Plugin](https://github.com/jenkinsci/mcp-server-plugin) by calling Jenkins REST API over HTTP.

**No plugin installation required on your Jenkins instance.**

## Why?

The official Jenkins MCP Server Plugin must be installed on the Jenkins server. If you don't have admin rights to install plugins, `host-mcp-jenkins` gives you the same 16 MCP tools running locally, calling Jenkins REST API with your personal API token.

## Compatibility

| Jenkins Version | Status |
|-----------------|--------|
| LTS 2.462.x+ | ✅ Fully supported |
| LTS 2.426.x | ✅ Fully supported |
| LTS 2.401.x | ✅ Fully supported |
| LTS 2.361.x | ✅ Fully supported |
| Weekly (latest) | ✅ Fully supported |

> **Minimum version:** Jenkins 2.164+. All REST API endpoints used by this server have been available in Jenkins core since the earliest 2.x releases. The `tree` query parameter (used for response field filtering) was introduced in Jenkins 1.464.

### Plugin Dependencies

Most tools (11 out of 17) use only the Jenkins core REST API and require no plugins. Some tool categories depend on specific plugins:

| Tools | Required Plugin | Min Plugin Version | Notes |
|---|---|:---:|---|
| `getJobScm`, `getBuildScm`, `findJobsWithScmUrl` | [Git Plugin](https://plugins.jenkins.io/git/) | 2.0+ | SCM data exposed via Git plugin actions |
| `getTestResults` | [JUnit Plugin](https://plugins.jenkins.io/junit/) | 1.0+ | Bundled with Jenkins since 1.577 |
| `getFlakyFailures` | [JUnit Plugin](https://plugins.jenkins.io/junit/) | 1.33+ | Flaky test detection support required |

> **Note:** The Git Plugin is installed on ~96% of Jenkins controllers. The JUnit Plugin is installed on ~97% and has been bundled with Jenkins by default since version 1.577. If these plugins are not present, the corresponding tools will return empty results or 404 errors.

### API Endpoint Matrix

Every tool maps to one or more Jenkins REST API endpoints. All JSON endpoints support the `tree` parameter for field filtering.

| Tool | Method | REST Endpoint | Dependency |
|---|:---:|---|---|
| `getJob` | GET | `/job/{name}/api/json` | Core |
| `getJobs` | GET | `/api/json` | Core |
| `getBuild` | GET | `/job/{name}/{build\|lastBuild}/api/json` | Core |
| `triggerBuild` | POST | `/job/{name}/build`, `/job/{name}/buildWithParameters` | Core |
| `updateBuild` | POST | `/job/{name}/{build}/submitDescription`, `configSubmit` | Core |
| `whoAmI` | GET | `/me/api/json` | Core |
| `getStatus` | GET | `/api/json`, `/computer/api/json`, `/queue/api/json` | Core |
| `getQueueItem` | GET | `/queue/item/{id}/api/json` | Core |
| `getBuildLog` | GET | `/job/{name}/{build}/consoleText` | Core |
| `getProgressiveBuildLog` | GET | `/job/{name}/{build}/logText/progressiveText` | Core |
| `searchBuildLog` | GET | `/job/{name}/{build}/consoleText` | Core |
| `getJobScm` | GET | `/job/{name}/api/json` | Git Plugin |
| `getBuildScm` | GET | `/job/{name}/{build}/api/json` | Git Plugin |
| `getBuildChangeSets` | GET | `/job/{name}/{build}/api/json` | Core |
| `findJobsWithScmUrl` | GET | `/api/json` (recursive 3-level tree) | Git Plugin |
| `getTestResults` | GET | `/job/{name}/{build}/testReport/api/json` | JUnit Plugin |
| `getFlakyFailures` | GET | `/job/{name}/{build}/testReport/api/json` | JUnit Plugin ≥ 1.33 |

## Quick Start

```bash
npx @mister-good-deal/host-mcp-jenkins \
  --jenkins-url https://jenkins.example.com \
  --jenkins-user your-username \
  --jenkins-token your-api-token
```

## Configuration

All options support both CLI arguments and environment variables (CLI takes precedence):

| CLI Argument | Environment Variable | Required | Default | Description |
|---|---|:---:|---|---|
| `--jenkins-url` | `JENKINS_URL` | ✅ | — | Jenkins base URL |
| `--jenkins-user` | `JENKINS_USER` | ✅ | — | Jenkins username |
| `--jenkins-token` | `JENKINS_API_TOKEN` | ✅ | — | Jenkins API token |
| `--insecure` | `JENKINS_INSECURE=true` | | `false` | Skip TLS certificate verification |
| `--log-level` | `LOG_LEVEL` | | `info` | `debug` \| `info` \| `warn` \| `error` |
| `--timeout` | `JENKINS_TIMEOUT` | | `30000` | HTTP request timeout (ms) |

### Getting a Jenkins API Token

1. Log in to Jenkins
2. Click your username (top-right) → **Configure**
3. Under **API Token**, click **Add new Token**
4. Name it and click **Generate** — copy the token value

## MCP Client Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "jenkins": {
      "command": "npx",
      "args": ["-y", "@mister-good-deal/host-mcp-jenkins"],
      "env": {
        "JENKINS_URL": "https://jenkins.example.com",
        "JENKINS_USER": "your-username",
        "JENKINS_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

### VS Code

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "jenkins": {
      "command": "npx",
      "args": ["-y", "@mister-good-deal/host-mcp-jenkins"],
      "env": {
        "JENKINS_URL": "https://jenkins.example.com",
        "JENKINS_USER": "your-username",
        "JENKINS_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

### Cursor

Add to your MCP server configuration:

```json
{
  "mcpServers": {
    "jenkins": {
      "command": "npx",
      "args": ["-y", "@mister-good-deal/host-mcp-jenkins", "--jenkins-url", "https://jenkins.example.com", "--jenkins-user", "your-username", "--jenkins-token", "your-api-token"]
    }
  }
}
```

> **Note for contributors:** If you're running the MCP server from within this workspace (where `package.json` declares `"packageManager": "pnpm@..."`) and `npx` fails with `host-mcp-jenkins: not found`, use `pnpm dlx` instead. This happens because corepack intercepts `npx` when run from a pnpm-managed project.

## Available Tools (17)

Full parity with the [Jenkins MCP Server Plugin](https://github.com/jenkinsci/mcp-server-plugin), plus extras:

### Core (8)

| Tool | Description |
|---|---|
| `getJob` | Get a Jenkins job by its full path |
| `getJobs` | Get a paginated list of Jenkins jobs, sorted by name |
| `getBuild` | Get a specific build or the last build of a Jenkins job |
| `triggerBuild` | Trigger a build for a Jenkins job (supports parameters) |
| `updateBuild` | Update build display name and/or description |
| `whoAmI` | Get information about the currently authenticated user |
| `getStatus` | Check the health and readiness status of a Jenkins instance |
| `getQueueItem` | Get the queue item details by its ID |

### Build Logs (3)

| Tool | Description |
|---|---|
| `getBuildLog` | Retrieve paginated log lines for a build |
| `getProgressiveBuildLog` | Incrementally retrieve build logs via Jenkins progressive text API |
| `searchBuildLog` | Search for log lines matching a pattern (string or regex) |

### SCM (4)

| Tool | Description |
|---|---|
| `getJobScm` | Retrieve SCM configurations of a Jenkins job |
| `getBuildScm` | Retrieve SCM configurations of a Jenkins build |
| `getBuildChangeSets` | Retrieve change log sets of a Jenkins build |
| `findJobsWithScmUrl` | Find jobs that use a specified git SCM URL |

### Test Results (2)

| Tool | Description |
|---|---|
| `getTestResults` | Retrieve test results for a build (optionally only failures) |
| `getFlakyFailures` | Retrieve flaky test failures for a build |

## Comparison with Jenkins MCP Server Plugin

| Feature | Jenkins Plugin | host-mcp-jenkins |
|---|---|---|
| Installation | Requires Jenkins admin | None — runs locally |
| Transport | SSE, Streamable HTTP, Stateless | stdio (local) |
| Authentication | Jenkins built-in | API token over HTTP Basic |
| Tools | 16 | 17 (full parity + progressive log) |
| Response format | `ToolResponse` envelope | Same `ToolResponse` envelope |
| `tree` parameter | Via internal API | Forwarded to REST API |

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm run build

# Run in development mode
pnpm run dev -- --jenkins-url https://jenkins.example.com --jenkins-user admin --jenkins-token TOKEN

# Lint
pnpm run lint

# Unit tests
pnpm test

# Integration tests (requires Docker)
pnpm run test:integration
```

## License

MIT
