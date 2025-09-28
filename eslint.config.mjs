import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Ignore external libraries and generated files
    ignores: [
      "**/vane_lib/**/*",
      "**/libs/**/*",
      "**/*.wasm",
      "**/*.js.map",
      "**/dist/**/*",
      "**/node_modules/**/*",
    ]
  },
  {
    // Global rule overrides for more permissive linting
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-array-constructor": "off",
      "import/no-anonymous-default-export": "warn",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/prefer-as-const": "off",
    }
  }
];

export default eslintConfig;