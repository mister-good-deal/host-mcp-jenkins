import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
    preset: "ts-jest/presets/default-esm",
    testEnvironment: "node",
    extensionsToTreatAsEsm: [".ts"],
    transform: {
        "^.+\\.ts$": [
            "ts-jest",
            {
                useESM: true,
                tsconfig: "tsconfig.json"
            }
        ]
    },
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1"
    },
    moduleFileExtensions: ["ts", "js", "json"],
    transformIgnorePatterns: ["node_modules/(?!(@modelcontextprotocol)/)"],
    testMatch: ["**/tests/unit/**/*.test.ts"],
    setupFiles: ["./tests/unit/setup.ts"],
    collectCoverageFrom: [
        "src/**/*.ts",
        "!src/index.ts"
    ],
    coverageDirectory: "coverage"
};

export default config;
