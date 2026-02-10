import { describe, it, expect, jest, beforeEach } from "@jest/globals";

import { JenkinsClient, JenkinsClientError } from "../../../src/jenkins/client.js";

// Mock global fetch
const mockFetch = jest.fn();

global.fetch = mockFetch;

describe("JenkinsClient", () => {
    let client: JenkinsClient;

    beforeEach(() => {
        mockFetch.mockReset();
        client = new JenkinsClient({
            baseUrl: "https://jenkins.example.com",
            user: "admin",
            apiToken: "test-token",
            timeout: 5000
        });
    });

    describe("get", () => {
        it("should make authenticated GET requests", async() => {
            const mockData = { name: "testJob", color: "blue" };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async() => mockData
            });

            const result = await client.get("/job/testJob/api/json");

            expect(mockFetch).toHaveBeenCalledWith(
                "https://jenkins.example.com/job/testJob/api/json",
                expect.objectContaining({
                    method: "GET",
                    headers: { Authorization: expect.stringMatching(/^Basic /) }
                })
            );
            expect(result).toEqual(mockData);
        });

        it("should append tree query parameter", async() => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async() => ({ name: "test" })
            });

            await client.get("/job/test/api/json", { tree: "name,color" });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("?tree=name%2Ccolor"),
                expect.anything()
            );
        });

        it("should throw JenkinsClientError on 404", async() => {
            const mock404 = {
                ok: false,
                status: 404,
                statusText: "Not Found",
                text: async() => "Not Found"
            };

            mockFetch.mockResolvedValueOnce(mock404).mockResolvedValueOnce(mock404);

            await expect(client.get("/job/nonexistent/api/json")).rejects.toThrow(JenkinsClientError);
            await expect(client.get("/job/nonexistent/api/json")).rejects.toThrow(/not found/i);
        });

        it("should throw JenkinsClientError on 403", async() => {
            const mock403 = {
                ok: false,
                status: 403,
                statusText: "Forbidden",
                text: async() => "Forbidden"
            };

            mockFetch.mockResolvedValueOnce(mock403).mockResolvedValueOnce(mock403);

            await expect(client.get("/job/secret/api/json")).rejects.toThrow(JenkinsClientError);
            await expect(client.get("/job/secret/api/json")).rejects.toThrow(/Authentication failed/);
        });
    });

    describe("getText", () => {
        it("should return raw text", async() => {
            const logContent = "Line 1\nLine 2\nLine 3";

            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async() => logContent
            });

            const result = await client.getText("/job/test/1/consoleText");

            expect(result).toBe(logContent);
        });
    });

    describe("post", () => {
        it("should make authenticated POST requests", async() => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 201,
                headers: new Headers({ Location: "https://jenkins.example.com/queue/item/42/" }),
                text: async() => ""
            });

            const result = await client.post("/job/test/build");

            expect(mockFetch).toHaveBeenCalledWith(
                "https://jenkins.example.com/job/test/build",
                expect.objectContaining({
                    method: "POST",
                    headers: expect.objectContaining({
                        Authorization: expect.stringMatching(/^Basic /)
                    })
                })
            );
            expect(result.location).toBe("https://jenkins.example.com/queue/item/42/");
        });

        it("should handle URL-encoded form data", async() => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers(),
                text: async() => ""
            });

            const params = new URLSearchParams({ description: "test description" });

            await client.post("/job/test/1/submitDescription", params);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    body: params,
                    headers: expect.objectContaining({
                        "Content-Type": "application/x-www-form-urlencoded"
                    })
                })
            );
        });
    });

    describe("retry logic", () => {
        let retryClient: JenkinsClient;

        beforeEach(() => {
            retryClient = new JenkinsClient({
                baseUrl: "https://jenkins.example.com",
                user: "admin",
                apiToken: "test-token",
                timeout: 5000,
                maxRetries: 2,
                retryDelay: 10 // Very short for tests
            });
        });

        it("should retry on 503 and succeed", async() => {
            mockFetch.
                mockResolvedValueOnce({ ok: false, status: 503, statusText: "Service Unavailable", text: async() => "" }).
                mockResolvedValueOnce({ ok: true, json: async() => ({ status: "ok" }) });

            const result = await retryClient.get("/api/json");

            expect(result).toEqual({ status: "ok" });
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it("should retry on 500 and fail after max retries", async() => {
            const mock500 = { ok: false, status: 500, statusText: "Internal Server Error", text: async() => "error" };

            mockFetch.
                mockResolvedValueOnce(mock500).
                mockResolvedValueOnce(mock500).
                mockResolvedValueOnce(mock500);

            await expect(retryClient.get("/api/json")).rejects.toThrow(JenkinsClientError);
            expect(mockFetch).toHaveBeenCalledTimes(3); // initial + 2 retries
        });

        it("should not retry on 404", async() => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: "Not Found",
                text: async() => "Not Found"
            });

            await expect(retryClient.get("/job/nope/api/json")).rejects.toThrow(/not found/i);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it("should not retry on 401", async() => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: "Unauthorized",
                text: async() => "Unauthorized"
            });

            await expect(retryClient.get("/api/json")).rejects.toThrow(/Authentication failed/);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it("should retry on network errors", async() => {
            mockFetch.
                mockRejectedValueOnce(new TypeError("fetch failed")).
                mockResolvedValueOnce({ ok: true, json: async() => ({ status: "ok" }) });

            const result = await retryClient.get("/api/json");

            expect(result).toEqual({ status: "ok" });
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    describe("constructor", () => {
        it("should strip trailing slashes from base URL", () => {
            const c = new JenkinsClient({
                baseUrl: "https://jenkins.example.com///",
                user: "admin",
                apiToken: "token",
                timeout: 5000
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async() => ({})
            });

            c.get("/api/json");

            expect(mockFetch).toHaveBeenCalledWith(
                "https://jenkins.example.com/api/json",
                expect.anything()
            );
        });
    });
});
