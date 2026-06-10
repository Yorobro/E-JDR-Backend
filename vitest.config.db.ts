import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Configuration Vitest des tests d'intégration base de données (Testcontainers).
 *
 * Séparée de la config principale : ces tests exigent Docker et démarrent un conteneur
 * MySQL jetable (lent au premier run — téléchargement de l'image). Lancement :
 * `npm run test:db`. Pas de mesure de couverture ici : ces tests valident le SQL réel,
 * pas la complétude de la couverture.
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
    include: ["tests/db/**/*.test.ts"],
    globalSetup: ["tests/db/globalSetup.ts"],
    // Démarrage du conteneur : généreux au premier run (pull de l'image).
    hookTimeout: 180_000,
    testTimeout: 30_000,
    // Un seul worker : toutes les suites partagent le même conteneur/schéma.
    pool: "threads",
    poolOptions: { threads: { singleThread: true } },
  },
});
