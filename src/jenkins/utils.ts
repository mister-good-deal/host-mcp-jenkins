/**
 * Converts a Jenkins job full name (e.g., "folder/subfolder/myJob")
 * to the Jenkins URL path format (e.g., "/job/folder/job/subfolder/job/myJob").
 */
export function jobFullNameToPath(jobFullName: string): string {
    const parts = jobFullName.split("/").filter(p => p.length > 0);

    return parts.map(p => `/job/${encodeURIComponent(p)}`).join("");
}

/**
 * Builds a query string from a record of key-value pairs.
 * Skips undefined and null values.
 */
export function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
    const parts: string[] = [];

    for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

    return parts.length > 0 ? `?${parts.join("&")}` : "";
}
