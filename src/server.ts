import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { Config } from "./config.js";
import { JenkinsClient } from "./jenkins/client.js";
import { getLogger } from "./logger.js";
import { registerCoreTools } from "./tools/core.js";
import { registerLogTools } from "./tools/logs.js";
import { registerScmTools } from "./tools/scm.js";
import { registerTestTools } from "./tools/tests.js";

export function createServer(config: Config): McpServer {
    const logger = getLogger();

    const server = new McpServer({
        name: "host-mcp-jenkins",
        version: "0.1.0"
    });

    const client = new JenkinsClient({
        baseUrl: config.jenkinsUrl,
        user: config.jenkinsUser,
        apiToken: config.jenkinsApiToken,
        timeout: config.timeout,
        maxRetries: config.maxRetries,
        retryDelay: config.retryDelay
    });

    logger.info(`Registering tools for Jenkins instance: ${config.jenkinsUrl}`);

    registerCoreTools(server, client);
    registerLogTools(server, client);
    registerScmTools(server, client);
    registerTestTools(server, client);

    logger.info("All 16 MCP tools registered successfully");

    return server;
}
