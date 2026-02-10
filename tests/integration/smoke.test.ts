import { describe, it, expect, beforeAll } from "@jest/globals";

import type { JenkinsRootInfo, JenkinsUser } from "../../src/jenkins/types.js";

import { createIntegrationClient, waitForJenkins } from "./setup.js";

describe("Integration: Smoke Tests", () => {
    const client = createIntegrationClient();

    beforeAll(async() => {
        await waitForJenkins(client);
    }, 120_000);

    it("should connect to Jenkins and get root info", async() => {
        const root = await client.get<JenkinsRootInfo>("/api/json", {
            tree: "mode,nodeDescription,numExecutors,url"
        });

        expect(root).toBeDefined();
        expect(root.numExecutors).toBeGreaterThanOrEqual(0);
    });

    it("should authenticate and return user info", async() => {
        const user = await client.get<JenkinsUser>("/me/api/json");

        expect(user).toBeDefined();
        expect(user.fullName).toBeTruthy();
    });

    it("should return an empty job list on fresh instance", async() => {
        const root = await client.get<JenkinsRootInfo>("/api/json", {
            tree: "jobs[name,fullName]"
        });

        // Fresh Jenkins has no jobs (or just default ones)
        expect(root.jobs).toBeDefined();
        expect(Array.isArray(root.jobs)).toBe(true);
    });

    it("should handle 404 for non-existent job", async() => {
        await expect(
            client.get("/job/this-job-does-not-exist/api/json")
        ).rejects.toThrow(/not found/i);
    });

    it("should get queue info", async() => {
        const queue = await client.get<{ items: unknown[] }>("/queue/api/json", {
            tree: "items[id]"
        });

        expect(queue).toBeDefined();
        expect(Array.isArray(queue.items)).toBe(true);
    });
});
