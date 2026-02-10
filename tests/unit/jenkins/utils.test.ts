import { describe, it, expect } from "@jest/globals";

import { jobFullNameToPath, buildQueryString } from "../../../src/jenkins/utils.js";

describe("jobFullNameToPath", () => {
    it("should convert a simple job name", () => {
        expect(jobFullNameToPath("myJob")).toBe("/job/myJob");
    });

    it("should convert a nested job name with folders", () => {
        expect(jobFullNameToPath("folder/subfolder/myJob")).toBe("/job/folder/job/subfolder/job/myJob");
    });

    it("should handle a single folder", () => {
        expect(jobFullNameToPath("folder/myJob")).toBe("/job/folder/job/myJob");
    });

    it("should handle job names with special characters", () => {
        expect(jobFullNameToPath("my folder/my job")).toBe("/job/my%20folder/job/my%20job");
    });

    it("should handle leading/trailing slashes gracefully", () => {
        expect(jobFullNameToPath("/folder/job/")).toBe("/job/folder/job/job");
    });

    it("should handle empty string", () => {
        expect(jobFullNameToPath("")).toBe("");
    });
});

describe("buildQueryString", () => {
    it("should build a query string from params", () => {
        expect(buildQueryString({ tree: "name,color", depth: 1 })).toBe("?tree=name%2Ccolor&depth=1");
    });

    it("should skip undefined and null values", () => {
        expect(buildQueryString({ tree: "name", depth: undefined, foo: null })).toBe("?tree=name");
    });

    it("should return empty string when no valid params", () => {
        expect(buildQueryString({ a: undefined, b: null })).toBe("");
    });

    it("should return empty string for empty object", () => {
        expect(buildQueryString({})).toBe("");
    });

    it("should handle boolean values", () => {
        expect(buildQueryString({ pretty: true })).toBe("?pretty=true");
    });
});
