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
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
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
