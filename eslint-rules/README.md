# Local ESLint rules plugin

This folder contains a local ESLint plugin providing custom rules for Clean Architecture enforcement and other maintainability checks.

Usage

- Build: `npm run build` (from `eslint-rules` folder).
- From repository root: `npm run build:eslint-rules` (this project provides a helper script).
- The root ESLint config imports the built `lib/index.js` and exposes rules under the `@local/eslint-rules` plugin.

Add new rules under `src/rules/` and export them from `src/index.ts`. Run `npm run build` to produce `lib/`.
