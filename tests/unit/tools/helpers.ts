import { jest } from "@jest/globals";

import type { JenkinsClient } from "../../../src/jenkins/client.js";
import { JenkinsClientError } from "../../../src/jenkins/client.js";
import { initLogger } from "../../../src/logger.js";

// Initialize logger for tests (silent)
beforeAll(() => {
    initLogger("error");
});

/**
 * Create a mock JenkinsClient for testing tools.
 */
export function createMockClient(): jest.Mocked<JenkinsClient> {
    return {
        get: jest.fn(),
        getText: jest.fn(),
        getTextWithHeaders: jest.fn(),
        post: jest.fn(),
        head: jest.fn()
    } as unknown as jest.Mocked<JenkinsClient>;
}

/**
 * Helper to make a 404 error.
 */
export function make404(url = "test"): JenkinsClientError {
    return new JenkinsClientError(`Resource not found: ${url}`, 404);
}

/**
 * Extract the ToolResponse from an MCP CallToolResult.
 */
export function extractToolResponse(result: { content: Array<{ type: string; text: string }>; isError?: boolean }) {
    const text = result.content[0].text;

    return JSON.parse(text) as { status: string; message: string; result: unknown };
}
