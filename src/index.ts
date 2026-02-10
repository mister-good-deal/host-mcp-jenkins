#!/usr/bin/env node

import { createServer as createHttpServer } from "node:http";
import { randomUUID } from "node:crypto";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { parseConfig } from "./config.js";
import { initLogger } from "./logger.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
    const config = parseConfig();

    // Handle --insecure: skip TLS verification
    if (config.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const logger = initLogger(config.logLevel);

    logger.info("Starting host-mcp-jenkins MCP server");
    logger.debug(`Config: url=${config.jenkinsUrl}, user=${config.jenkinsUser}, insecure=${config.insecure}, timeout=${config.timeout}ms, transport=${config.transport}`);

    const server = createServer(config);

    if (config.transport === "http") await startHttpTransport(server, config.port);
    else await startStdioTransport(server);
}

async function startStdioTransport(server: ReturnType<typeof createServer>): Promise<void> {
    const logger = (await import("./logger.js")).getLogger();
    const transport = new StdioServerTransport();

    await server.connect(transport);

    logger.info("MCP server connected via stdio transport");
}

async function startHttpTransport(server: ReturnType<typeof createServer>, port: number): Promise<void> {
    const logger = (await import("./logger.js")).getLogger();

    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID()
    });

    await server.connect(transport);

    const httpServer = createHttpServer(async(req, res) => {
        const url = req.url ?? "/";

        // Health check endpoint
        if (url === "/health" && req.method === "GET") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "ok" }));

            return;
        }

        // MCP endpoint — handle all methods at /mcp
        if (url === "/mcp") {
            await transport.handleRequest(req, res);

            return;
        }

        res.writeHead(404);
        res.end("Not Found");
    });

    httpServer.listen(port, () => {
        logger.info(`MCP server listening on http://localhost:${port}/mcp (Streamable HTTP transport)`);
    });

    // Graceful shutdown
    const shutdown = () => {
        logger.info("Shutting down HTTP server...");
        httpServer.close();
        transport.close();
        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

main().catch(error => {
    console.error("Fatal error:", error instanceof Error ? error.message : error);
    process.exit(1);
});
