import globals from "globals";
import pluginJs from "@eslint/js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"], 
    ...pluginJs.configs.recommended,
    languageOptions: { globals: globals.browser }
  }
];
