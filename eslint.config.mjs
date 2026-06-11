// Configuration ESLint (flat config, ESLint 9 + typescript-eslint).
//
// Objectif : détecter les vraies anomalies (variables/imports inutiles, `any` implicite,
// promesses non gérées) sans imposer un style de mise en forme — celui-ci est délégué à
// Prettier (eslint-config-prettier neutralise les règles de format conflictuelles).

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import localRules from "./eslint-rules/lib/index.js";

export default tseslint.config(
  {
    // Fichiers/dosssiers exclus de l'analyse.
    ignores: ["dist/**", "node_modules/**", "coverage/**", "eslint-rules/**"],
  },
  {
    // Plugin local: règles de qualité et d'architecture
    plugins: { ejdr: localRules },
    rules: {
      "ejdr/clean-architecture": "error",
      "ejdr/file-size": ["error", { max: 500 }],
      "ejdr/function-size": ["error", { max: 100 }],
      // Seuil à 6 (au lieu du défaut 4) : les constructeurs de use cases utilisent
      // l'injection manuelle de dépendances (repo, services, hasher…) ce qui génère
      // légitimement 5-6 paramètres. Ce n'est pas un code smell, c'est de la DI.
      "ejdr/parameter-count": ["error", { max: 6 }],
      "ejdr/naming-convention": "error",
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      // Le serveur journalise volontairement via console (composition root, errorHandler).
      "no-console": "warn",
      // Cohérent avec `noUnusedLocals`/`noUnusedParameters` côté tsc : on tolère le préfixe `_`.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Les tests peuvent utiliser des assertions de type souples et des doublures.
    // La taille des callbacks describe/it n'est pas un indicateur pertinent dans les suites de test.
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "ejdr/function-size": "off",
    },
  },
  {
    // Scripts CLI (runner de migrations) : la sortie console est leur interface légitime.
    files: ["db/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
  // Doit rester en dernier : désactive toute règle ESLint en conflit avec Prettier.
  prettier,
);
