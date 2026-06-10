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
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      // Exclus de la mesure : le composition root (câblage, testé en intégration), la
      // connexion MySQL et les DAO (SQL pur, couverts par de futurs tests Testcontainers),
      // ainsi que les interfaces/commandes/erreurs (purement déclaratives).
      exclude: [
        "src/main.ts",
        "src/infrastructure/persistence/mysql/MysqlConnection.ts",
        "src/infrastructure/persistence/mysql/**/dao/**",
        "src/**/abstractions/**",
        "src/**/commands/**",
      ],
      // Seuils plancher : la CI échoue sous ces valeurs (garde-fou anti-régression de tests).
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});


