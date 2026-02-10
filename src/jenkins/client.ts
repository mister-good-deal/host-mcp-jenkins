import { getLogger } from "../logger.js";
import { buildQueryString } from "./utils.js";

export interface JenkinsClientConfig {
    baseUrl: string;
    user: string;
    apiToken: string;
    timeout: number;
}

export class JenkinsClientError extends Error {
    constructor(
        message: string,
        public readonly statusCode: number,
        public readonly jenkinsBody?: string
    ) {
        super(message);
        this.name = "JenkinsClientError";
    }
}

export class JenkinsClient {
    private readonly baseUrl: string;
    private readonly authHeader: string;
    private readonly timeout: number;

    constructor(config: JenkinsClientConfig) {
        this.baseUrl = config.baseUrl.replace(/\/+$/, "");
        this.authHeader = "Basic " + Buffer.from(`${config.user}:${config.apiToken}`).toString("base64");
        this.timeout = config.timeout;
    }

    /**
     * Perform a GET request to the Jenkins API.
     */
    async get<T = unknown>(
        path: string,
        query?: Record<string, string | number | boolean | undefined | null>
    ): Promise<T> {
        const qs = query ? buildQueryString(query) : "";
        const url = `${this.baseUrl}${path}${qs}`;

        return this.request<T>("GET", url);
    }

    /**
     * Perform a GET request that returns raw text (e.g., console logs).
     */
    async getText(
        path: string,
        query?: Record<string, string | number | boolean | undefined | null>
    ): Promise<string> {
        const qs = query ? buildQueryString(query) : "";
        const url = `${this.baseUrl}${path}${qs}`;

        return this.requestText("GET", url);
    }

    /**
     * Perform a GET request that returns raw text along with response headers.
     * Useful for progressive log endpoints that use X-Text-Size / X-More-Data headers.
     */
    async getTextWithHeaders(
        path: string,
        query?: Record<string, string | number | boolean | undefined | null>
    ): Promise<{ text: string; headers: Headers }> {
        const qs = query ? buildQueryString(query) : "";
        const url = `${this.baseUrl}${path}${qs}`;
        const logger = getLogger();

        logger.debug(`GET ${url}`);

        const response = await fetch(url, {
            method: "GET",
            headers: { Authorization: this.authHeader },
            signal: AbortSignal.timeout(this.timeout)
        });

        if (!response.ok) {
            await this.handleError(response, url);
        }

        const text = await response.text();

        return { text, headers: response.headers };
    }

    /**
     * Perform a POST request to the Jenkins API.
     * Returns the response parsed as JSON, or the Location header for build triggers.
     */
    async post<T = unknown>(
        path: string,
        body?: Record<string, unknown> | URLSearchParams,
        query?: Record<string, string | number | boolean | undefined | null>
    ): Promise<{ data: T | null; location: string | null }> {
        const qs = query ? buildQueryString(query) : "";
        const url = `${this.baseUrl}${path}${qs}`;
        const logger = getLogger();

        logger.debug(`POST ${url}`);

        const headers: Record<string, string> = {
            Authorization: this.authHeader
        };

        let fetchBody: string | URLSearchParams | undefined;

        if (body instanceof URLSearchParams) {
            headers["Content-Type"] = "application/x-www-form-urlencoded";
            fetchBody = body;
        } else if (body) {
            headers["Content-Type"] = "application/json";
            fetchBody = JSON.stringify(body);
        }

        const response = await fetch(url, {
            method: "POST",
            headers,
            body: fetchBody,
            signal: AbortSignal.timeout(this.timeout),
            redirect: "manual"
        });

        const location = response.headers.get("Location");

        /*
         * Jenkins returns 201 for build trigger with Location header
         * and sometimes 302 redirect
         */
        if (response.status === 201 || response.status === 302) {
            return { data: null, location };
        }

        if (!response.ok) {
            await this.handleError(response, url);
        }

        const text = await response.text();

        if (text.length === 0) {
            return { data: null, location };
        }

        try {
            return { data: JSON.parse(text) as T, location };
        } catch {
            return { data: null, location };
        }
    }

    /**
     * Perform a HEAD request — useful for checking resource existence.
     */
    async head(path: string): Promise<{ status: number; headers: Headers }> {
        const url = `${this.baseUrl}${path}`;
        const logger = getLogger();

        logger.debug(`HEAD ${url}`);

        const response = await fetch(url, {
            method: "HEAD",
            headers: { Authorization: this.authHeader },
            signal: AbortSignal.timeout(this.timeout)
        });

        return { status: response.status, headers: response.headers };
    }

    private async request<T>(method: string, url: string): Promise<T> {
        const logger = getLogger();

        logger.debug(`${method} ${url}`);

        const response = await fetch(url, {
            method,
            headers: { Authorization: this.authHeader },
            signal: AbortSignal.timeout(this.timeout)
        });

        if (!response.ok) {
            await this.handleError(response, url);
        }

        return response.json() as Promise<T>;
    }

    private async requestText(method: string, url: string): Promise<string> {
        const logger = getLogger();

        logger.debug(`${method} ${url}`);

        const response = await fetch(url, {
            method,
            headers: { Authorization: this.authHeader },
            signal: AbortSignal.timeout(this.timeout)
        });

        if (!response.ok) {
            await this.handleError(response, url);
        }

        return response.text();
    }

    private async handleError(response: Response, url: string): Promise<never> {
        const body = await response.text().catch(() => "");

        if (response.status === 401 || response.status === 403) {
            throw new JenkinsClientError(
                `Authentication failed (${response.status}). Check your Jenkins URL, username, and API token.`,
                response.status,
                body
            );
        }

        if (response.status === 404) {
            throw new JenkinsClientError(
                `Resource not found: ${url}`,
                response.status,
                body
            );
        }

        throw new JenkinsClientError(
            `Jenkins API error (${response.status}): ${body || response.statusText}`,
            response.status,
            body
        );
    }
}
