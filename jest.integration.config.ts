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
    transformIgnorePatterns: ["node_modules/(?!(@modelcontextprotocol)/)"],
    testMatch: ["**/tests/integration/**/*.test.ts"],
    testTimeout: 30000
};

export default config;
