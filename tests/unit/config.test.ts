import { describe, it, expect } from "@jest/globals";

import { parseConfig } from "../../src/config.js";

describe("parseConfig", () => {
    const validArgs = [
        "node",
        "index.js",
        "--jenkins-url",
        "https://jenkins.example.com",
        "--jenkins-user",
        "admin",
        "--jenkins-token",
        "my-api-token"
    ];

    it("should parse valid CLI arguments", () => {
        const config = parseConfig(validArgs);

        expect(config.jenkinsUrl).toBe("https://jenkins.example.com");
        expect(config.jenkinsUser).toBe("admin");
        expect(config.jenkinsApiToken).toBe("my-api-token");
        expect(config.insecure).toBe(false);
        expect(config.logLevel).toBe("info");
        expect(config.timeout).toBe(30000);
        expect(config.transport).toBe("stdio");
        expect(config.port).toBe(3000);
    });

    it("should parse --insecure flag", () => {
        const config = parseConfig([...validArgs, "--insecure"]);

        expect(config.insecure).toBe(true);
    });

    it("should parse --log-level option", () => {
        const config = parseConfig([...validArgs, "--log-level", "debug"]);

        expect(config.logLevel).toBe("debug");
    });

    it("should parse --timeout option", () => {
        const config = parseConfig([...validArgs, "--timeout", "10000"]);

        expect(config.timeout).toBe(10000);
    });

    it("should strip trailing slash from Jenkins URL", () => {
        const config = parseConfig([
            "node",
            "index.js",
            "--jenkins-url",
            "https://jenkins.example.com/",
            "--jenkins-user",
            "admin",
            "--jenkins-token",
            "token"
        ]);

        expect(config.jenkinsUrl).toBe("https://jenkins.example.com");
    });

    it("should throw if --jenkins-url is missing", () => {
        expect(() => parseConfig([
            "node",
            "index.js",
            "--jenkins-user",
            "admin",
            "--jenkins-token",
            "token"
        ])).toThrow(/Missing required configuration.*jenkins-url/);
    });

    it("should throw if --jenkins-user is missing", () => {
        expect(() => parseConfig([
            "node",
            "index.js",
            "--jenkins-url",
            "https://jenkins.example.com",
            "--jenkins-token",
            "token"
        ])).toThrow(/Missing required configuration.*jenkins-user/);
    });

    it("should throw if --jenkins-token is missing", () => {
        expect(() => parseConfig([
            "node",
            "index.js",
            "--jenkins-url",
            "https://jenkins.example.com",
            "--jenkins-user",
            "admin"
        ])).toThrow(/Missing required configuration.*jenkins-token/);
    });

    it("should throw on invalid log level", () => {
        expect(() => parseConfig([
            ...validArgs,
            "--log-level",
            "verbose"
        ])).toThrow(/Invalid log level/);
    });

    it("should parse --transport http with --port", () => {
        const config = parseConfig([...validArgs, "--transport", "http", "--port", "8080"]);

        expect(config.transport).toBe("http");
        expect(config.port).toBe(8080);
    });

    it("should throw on invalid transport type", () => {
        expect(() => parseConfig([
            ...validArgs,
            "--transport",
            "websocket"
        ])).toThrow(/Invalid transport/);
    });

    it("should fall back to environment variables", () => {
        const originalEnv = { ...process.env };

        process.env.JENKINS_URL = "https://env-jenkins.example.com";
        process.env.JENKINS_USER = "env-user";
        process.env.JENKINS_API_TOKEN = "env-token";

        try {
            const config = parseConfig(["node", "index.js"]);

            expect(config.jenkinsUrl).toBe("https://env-jenkins.example.com");
            expect(config.jenkinsUser).toBe("env-user");
            expect(config.jenkinsApiToken).toBe("env-token");
        } finally {
            process.env = originalEnv;
        }
    });
});
