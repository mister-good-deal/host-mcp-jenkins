#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { parseConfig } from "./config.js";
import { initLogger } from "./logger.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
    const config = parseConfig();

    // Handle --insecure: skip TLS verification
    if (config.insecure) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    const logger = initLogger(config.logLevel);

    logger.info("Starting host-mcp-jenkins MCP server");
    logger.debug(`Config: url=${config.jenkinsUrl}, user=${config.jenkinsUser}, insecure=${config.insecure}, timeout=${config.timeout}ms`);

    const server = createServer(config);
    const transport = new StdioServerTransport();

    await server.connect(transport);

    logger.info("MCP server connected via stdio transport");
}

main().catch(error => {
    console.error("Fatal error:", error instanceof Error ? error.message : error);
    process.exit(1);
});
