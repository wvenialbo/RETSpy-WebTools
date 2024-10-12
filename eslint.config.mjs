import eslintJs from "@eslint/js";
import stylisticJs from "@stylistic/eslint-plugin-js";
import pluginJson from "eslint-plugin-json";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import pluginSonarJs from "eslint-plugin-sonarjs";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import globals from "globals";
import eslintTs from "typescript-eslint";

const pluginUnicorn = {
  configs: {
    recommended: eslintPluginUnicorn.configs["flat/recommended"],
  },
};

const pluginPrettier = {
  configs: {
    recommended: eslintPluginPrettier,
  },
};

const config = [
  eslintJs.configs.recommended,
  pluginUnicorn.configs.recommended,
  pluginSonarJs.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.builtin,
        ...globals.browser,
        ...globals.webextensions,
        ...globals.es2024,
        chrome: "readonly",
      },
    },
    rules: {
      semi: ["error", "always"],
      quotes: ["error", "double"],
      "class-methods-use-this": [
        "error",
        { exceptMethods: [], enforceForClassFields: false },
      ],
      "no-unused-vars": ["error", { argsIgnorePattern: "_", args: "all" }],
      "sonarjs/no-commented-code": "off",
      "sonarjs/todo-tag": "off",
      "sonarjs/public-static-readonly": "off",
      "unicorn/prevent-abbreviations": "off",
      "unicorn/better-regex": "error",
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    ...eslintTs.configs.recommendedTypeChecked,
    ...eslintTs.configs.stylisticTypeChecked,
  },
  {
    files: ["**/*.json"],
    ...pluginJson.configs.recommended,
  },
  {
    ignores: [
      "**/dist/**/*",
      "**/build/**",
      "**/*.min.js",
      "**/.vscode/**/*",
      "eslint.config.mjs",
    ],
  },
  {
    plugins: {
      "@stylistic/js": stylisticJs,
    },
    rules: {
      indent: ["error", 2],
      "@stylistic/js/indent": ["error", 2],
      "@stylistic/js/comma-dangle": ["error", "always-multiline"],
      "@stylistic/js/indent": ["error", 2, { SwitchCase: 1 }],
      "@stylistic/js/lines-between-class-members": ["error", {
        enforce: [
          { blankLine: "always", prev: "*", next: "method" },
          { blankLine: "always", prev: "method", next: "field" },
          { blankLine: "never", prev: "field", next: "field" },
        ]
      },],
    },
  },
  pluginPrettier.configs.recommended,
];

export default config;
