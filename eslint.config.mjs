// @ts-check

import eslint from "@eslint/js";
import tsEslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";
import globals from "globals";

export default tsEslint.config(
    // js
    eslint.configs.recommended,
    // ts
    ...tsEslint.configs.recommended,
    // ts config
    {
        name: "TS parser",
        languageOptions: {
            parser: tsEslint.parser,
            parserOptions: {
                ecmaVersion: "latest",
                project: "./tsconfig.eslint.json",
                loadTypeScriptPlugins: !!process.env.VSCODE_PID,
                tsconfigRootDir: import.meta.dirname
            }
        }
    },
    {
        name: "TS rules",
        plugins: {
            "@typescript-eslint": tsEslint.plugin
        },
        rules: {
            "@typescript-eslint/consistent-type-exports": "error",
            "@typescript-eslint/consistent-type-imports": "error",
            "no-useless-escape": "off",
            "@typescript-eslint/no-misused-promises": [
                "error",
                {
                    checksVoidReturn: false
                }
            ],
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    args: "all",
                    argsIgnorePattern: "^_",
                    caughtErrors: "all",
                    caughtErrorsIgnorePattern: "^_",
                    destructuredArrayIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    ignoreRestSiblings: true
                }
            ],
            "no-dupe-class-members": "off", // Allow overloads in classes with TS
            "curly": ["error", "multi-line"]
        }
    },

    stylistic.configs["all-flat"],
    {
        name: "stylistic",
        plugins: {
            "@stylistic": stylistic
        },
        rules: {
            "@stylistic/quote-props": ["error", "consistent-as-needed"],
            "@stylistic/array-element-newline": ["error", "consistent"],
            "@stylistic/object-curly-spacing": ["error", "always", { objectsInObjects: false }],
            "@stylistic/curly-newline": ["error", { multiline: true, consistent: true }],
            "@stylistic/brace-style": ["error", "1tbs", { allowSingleLine: true }],
            "@stylistic/lines-between-class-members": [
                "error",
                { enforce: [{ blankLine: "always", prev: "method", next: "method" }] },
                { exceptAfterSingleLine: true }
            ],
            "@stylistic/object-property-newline": ["error", { allowAllPropertiesOnSameLine: true }],
            "@stylistic/padded-blocks": ["error", "never", { allowSingleLineBlocks: true }],
            "@stylistic/function-call-argument-newline": ["error", "consistent"],
            "@stylistic/multiline-ternary": ["error", "always-multiline"],
            "@stylistic/arrow-parens": ["error", "as-needed"],
            "@stylistic/function-paren-newline": ["error", "consistent"],
            "@stylistic/eol-last": ["error", "always"],
            "@stylistic/no-tabs": "error",
            "@stylistic/no-trailing-spaces": "error",
            "@stylistic/no-extra-semi": "error",
            "@stylistic/no-multiple-empty-lines": ["error", { max: 1, maxEOF: 1, maxBOF: 0 }],
            "@stylistic/nonblock-statement-body-position": "error",
            "@stylistic/space-before-function-paren": ["error", "never"],
            "@stylistic/newline-per-chained-call": ["error", { ignoreChainWithDepth: 8 }],
            "@stylistic/padding-line-between-statements": [
                "error",
                // Always add a blank line before those statements unless they are the first statement in a block
                { blankLine: "always", prev: "*", next: ["return", "try", "throw", "for", "while", "do", "class"] },
                // Block level statements that can be grouped together
                { blankLine: "always", prev: ["const", "let"], next: "*" },
                { blankLine: "any", prev: ["const", "let"], next: ["const", "let"] },
                { blankLine: "always", prev: ["export", "import"], next: "*" },
                { blankLine: "any", prev: ["export", "import"], next: ["export", "import"] },
                { blankLine: "always", prev: ["if"], next: "*" },
                { blankLine: "any", prev: ["if"], next: ["if"] }
            ],
            "@stylistic/curly-newline": [
                "error", { multiline: true,
                    consistent: true }
            ],
            "@stylistic/quotes": ["error", "double"],
            "@stylistic/semi": ["error", "always"],
            "@stylistic/indent": [
                "error",
                4,
                {
                    SwitchCase: 1
                }
            ]
        }
    },
    {
        name: "globals",
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest
            }
        }
    },
    {
        name: "ignore",
        ignores: ["**/node_modules", "**/dist", "**/coverage", "eslint.config.mjs"]
    }
);
