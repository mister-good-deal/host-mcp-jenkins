import { Command } from "commander";

import type { LogLevel } from "./logger.js";
import { VERSION } from "./version.js";

export interface Config {
    jenkinsUrl: string;
    jenkinsUser: string;
    jenkinsApiToken: string;
    insecure: boolean;
    logLevel: LogLevel;
    timeout: number;
}

export function parseConfig(argv: string[] = process.argv): Config {
    const program = new Command();

    program.
        name("host-mcp-jenkins").
        description("Local MCP server for Jenkins — replicates Jenkins MCP Server Plugin via REST API").
        version(VERSION).
        option(
            "--jenkins-url <url>",
            "Jenkins base URL",
            process.env.JENKINS_URL
        ).
        option(
            "--jenkins-user <user>",
            "Jenkins username",
            process.env.JENKINS_USER
        ).
        option(
            "--jenkins-token <token>",
            "Jenkins API token",
            process.env.JENKINS_API_TOKEN
        ).
        option(
            "--insecure",
            "Skip TLS certificate verification",
            process.env.JENKINS_INSECURE === "true"
        ).
        option(
            "--log-level <level>",
            "Log level (debug|info|warn|error)",
            process.env.LOG_LEVEL ?? "info"
        ).
        option(
            "--timeout <ms>",
            "HTTP request timeout in milliseconds",
            process.env.JENKINS_TIMEOUT ?? "30000"
        );

    program.parse(argv);

    const opts = program.opts();

    const config: Config = {
        jenkinsUrl: opts.jenkinsUrl,
        jenkinsUser: opts.jenkinsUser,
        jenkinsApiToken: opts.jenkinsToken,
        insecure: opts.insecure ?? false,
        logLevel: opts.logLevel as LogLevel,
        timeout: parseInt(String(opts.timeout), 10)
    };

    validate(config);

    return config;
}

function validate(config: Config): void {
    const missing: string[] = [];

    if (!config.jenkinsUrl) {
        missing.push("--jenkins-url or JENKINS_URL");
    }

    if (!config.jenkinsUser) {
        missing.push("--jenkins-user or JENKINS_USER");
    }

    if (!config.jenkinsApiToken) {
        missing.push("--jenkins-token or JENKINS_API_TOKEN");
    }

    if (missing.length > 0) {
        throw new Error(`Missing required configuration: ${missing.join(", ")}`);
    }

    const validLevels: LogLevel[] = ["debug", "info", "warn", "error"];

    if (!validLevels.includes(config.logLevel)) {
        throw new Error(`Invalid log level: ${config.logLevel}. Must be one of: ${validLevels.join(", ")}`);
    }

    if (isNaN(config.timeout) || config.timeout <= 0) {
        throw new Error(`Invalid timeout: ${config.timeout}. Must be a positive number.`);
    }

    // Normalize URL — remove trailing slash
    config.jenkinsUrl = config.jenkinsUrl.replace(/\/+$/, "");
}
