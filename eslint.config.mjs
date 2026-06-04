import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored Stockfish build (minified, not our source).
    "public/**",
    // Node helper scripts (CommonJS, run outside the app bundle).
    "scripts/**",
    // Native Capacitor projects — they embed the built web bundle as assets.
    "android/**",
    "ios/**",
  ]),
]);

export default eslintConfig;
