export interface ToolResponse {
    status: "COMPLETED" | "FAILED";
    message: string;
    result: unknown;
}

/**
 * Build a successful ToolResponse envelope.
 */
export function toolSuccess(result: unknown, message = "Data retrieved successfully."): ToolResponse {
    return { status: "COMPLETED", message, result };
}

/**
 * Build a failed ToolResponse envelope.
 */
export function toolFailure(message: string, result: unknown = null): ToolResponse {
    return { status: "FAILED", message, result };
}

/**
 * Build a "not found" ToolResponse.
 */
export function toolNotFound(entity: string, identifier: string): ToolResponse {
    return toolFailure(`${entity} '${identifier}' not found.`);
}

/**
 * Build a "completed but no results" ToolResponse.
 */
export function toolEmpty(message = "Search completed, but no results were found."): ToolResponse {
    return { status: "COMPLETED", message, result: null };
}

/**
 * Build an error ToolResponse for unexpected/unhandled errors.
 * Unlike `toolFailure`, this is meant for truly unexpected conditions.
 */
export function toolError(error: unknown): ToolResponse {
    const message = error instanceof Error ? error.message : String(error);

    return { status: "FAILED", message: `Unexpected error: ${message}`, result: null };
}

/**
 * Wrap a ToolResponse as an MCP CallToolResult content block.
 */
export function toMcpResult(response: ToolResponse) {
    return {
        content: [{ type: "text" as const, text: JSON.stringify(response) }],
        isError: response.status === "FAILED"
    };
}
