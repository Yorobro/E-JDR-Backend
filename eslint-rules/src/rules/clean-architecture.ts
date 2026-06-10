import { Rule } from "eslint";
import { detectLayer, Layer } from "../utils/layer";
import { resolveImport } from "../utils/resolver";
import { isDependencyAllowed, allowedFor } from "../utils/validation";
import path from "path";

type MessageIds = "forbiddenDependency";


const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce Clean Architecture layering: domain|application|infrastructure|presentation",
      recommended: "error",
    },
    messages: {
      forbiddenDependency:
        "Forbidden dependency: files in layer '{{from}}' must not depend on layer '{{to}}' (import: '{{import}}'). Allowed layers: {{allowed}}",
    },
    schema: [],
  },

  create(context) {
    const fileName = context.getFilename();
    const projectRoot = process.cwd();
    if (!fileName || fileName === "<input>") return {};

    const fromLayer = detectLayer(fileName, projectRoot);
    if (fromLayer === "unknown") return {};

    function checkImport(importSource: any, node: any) {
      if (!importSource || typeof importSource !== "string") return;
      const resolved = resolveImport(importSource, fileName, projectRoot);
      if (!resolved) return; // external module or unable to resolve

      const toLayer = detectLayer(resolved, projectRoot);
      if (toLayer === "unknown") return; // non-src import

      if (isDependencyAllowed(fromLayer, toLayer)) return;

      context.report({
        node,
        messageId: "forbiddenDependency",
        data: {
          from: fromLayer,
          to: toLayer,
          import: importSource,
          allowed: allowedFor(fromLayer).join(", "),
        },
      });
    }

    return {
      ImportDeclaration(node) {
        // node.source.value
        // @ts-ignore
        const src = node.source && node.source.value;
        checkImport(src, node);
      },
      ExportAllDeclaration(node) {
        // @ts-ignore
        const src = node.source && node.source.value;
        checkImport(src, node);
      },
      ExportNamedDeclaration(node) {
        // @ts-ignore
        const src = node.source && node.source.value;
        checkImport(src, node);
      },
      CallExpression(node) {
        // require('x')
        // @ts-ignore
        if (node.callee && node.callee.type === "Identifier" && node.callee.name === "require") {
          // @ts-ignore
          const args = node.arguments || [];
          // @ts-ignore
          const first = args[0] && args[0].value;
          checkImport(first, node);
        }
      },
      ImportExpression(node) {
        // dynamic import('x')
        // @ts-ignore
        const src = node.source && node.source.value;
        checkImport(src, node);
      },
    };
  },
};

export = rule;
