import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettierConfig from "eslint-plugin-prettier/recommended";
import globals from "globals";

export default [
  {
    ignores: ["**/node_modules/", "**/dist/", "**/.cache", "**/*.gen.ts"],
  },
  {
    plugins: {
      ...prettierConfig.plugins,
      "@typescript-eslint": typescriptEslint,
    },
    languageOptions: {
      globals: { ...globals.node },
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    files: ["**/*.{js,ts}"],
    rules: {
      ...js.configs.recommended.rules,
      ...prettierConfig.rules,
      ...typescriptEslint.configs.recommended.rules,
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "prefer-const": ["error", { destructuring: "all" }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },
];
