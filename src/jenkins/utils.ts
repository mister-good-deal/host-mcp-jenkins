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

    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        }
    }

    return parts.length > 0 ? `?${parts.join("&")}` : "";
}

const HTML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" };

function decodeHtmlEntities(text: string): string {
    return text.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(\w+));/g, (entity, dec?: string, hex?: string, name?: string) => {
        if (dec) return String.fromCodePoint(Number(dec));

        if (hex) return String.fromCodePoint(parseInt(hex, 16));

        return HTML_ENTITIES[name!] ?? entity;
    });
}

/**
 * Extracts the Pipeline scripts from the HTML form of the replay action
 * (`/job/{name}/{build}/replay/`), which has no JSON API. Each script is a
 * `<textarea name="_.{key}">`; the key `mainScript` is the Jenkinsfile.
 */
export function parseReplayScripts(html: string): { mainScript?: string; loadedScripts: Record<string, string> } {
    const loadedScripts: Record<string, string> = {};
    let mainScript: string | undefined;

    for (const [, attributes, content] of html.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/g)) {
        const key = (/\bname="_\.([^"]+)"/).exec(attributes)?.[1];

        if (key === undefined) continue;

        if (key === "mainScript") mainScript = decodeHtmlEntities(content);
        else loadedScripts[key] = decodeHtmlEntities(content);
    }

    return { mainScript, loadedScripts };
}
