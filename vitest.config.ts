import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Configuration Vitest.
 *
 * On redéclare ici les alias de chemins du `tsconfig.json` pour que Vitest
 * (qui n'utilise pas `tsconfig-paths`) sache résoudre `@domain/*`, etc.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@domain": resolve(__dirname, "src/domain"),
      "@application": resolve(__dirname, "src/application"),
      "@infrastructure": resolve(__dirname, "src/infrastructure"),
      "@presentation": resolve(__dirname, "src/presentation"),
      "@config": resolve(__dirname, "src/config"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
