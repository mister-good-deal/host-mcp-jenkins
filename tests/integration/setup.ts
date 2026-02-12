import { JenkinsClient } from "../../src/jenkins/client.js";

/** Default integration test Jenkins config. */
export const JENKINS_CONFIG = {
    baseUrl: process.env.JENKINS_URL ?? "http://localhost:8080",
    user: process.env.JENKINS_USER ?? "admin",
    apiToken: process.env.JENKINS_API_TOKEN ?? "admin",
    timeout: 15_000
};

/** Create a JenkinsClient for integration tests. */
export function createIntegrationClient(): JenkinsClient {
    return new JenkinsClient(JENKINS_CONFIG);
}

/** Wait until Jenkins is ready, with a timeout. */
export async function waitForJenkins(client: JenkinsClient, timeoutMs = 120_000): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        try {
            await client.get("/api/json", { tree: "mode" });

            return;
        } catch {
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    throw new Error(`Jenkins did not become ready within ${timeoutMs}ms`);
}
