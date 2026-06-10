# Usage — Local ESLint rules plugin

1. Build the plugin (from repository root):

```bash
npm run build:eslint-rules
```

2. Lint (the repository `lint` script already builds the plugin first):

```bash
npm run lint
```

3. Add a rule:

- Create `src/rules/my-rule.ts` exporting an ESLint `RuleModule` via `export = rule;`.
- Export it from `src/index.ts` by adding an entry to the `rules` object.
- Run `npm run build` inside `eslint-rules` or `npm run build:eslint-rules` from root.
- Enable the rule in `eslint.config.mjs` under the `plugins` entry, e.g. `"ejdr/my-rule": "error"`.
