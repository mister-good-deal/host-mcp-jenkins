# host-mcp-jenkins

A local MCP (Model Context Protocol) server for Jenkins that replicates the [Jenkins MCP Server Plugin](https://github.com/jenkinsci/mcp-server-plugin) by calling Jenkins REST API over HTTP.

**No plugin installation required on your Jenkins instance.**

## Why?

The official Jenkins MCP Server Plugin must be installed on the Jenkins server. If you don't have admin rights to install plugins, `host-mcp-jenkins` gives you the same 16 MCP tools running locally, calling Jenkins REST API with your personal API token.

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
