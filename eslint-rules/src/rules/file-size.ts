import { Rule } from "eslint";

type Options = [{ max?: number }?];

const rule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce maximum file size (lines)",
      recommended: false,
    },
    messages: {
      tooLarge: "File is too large ({{lines}} lines). Consider splitting into smaller modules.",
    },
    schema: [
      {
        type: "object",
        properties: {
          max: { type: "number" },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const opts: Options = context.options as any;
    const max = (opts && opts[0] && opts[0].max) || 500;
    return {
      Program(node) {
        const source = context.getSourceCode();
        const lines = source.lines.length;
        if (lines > max) {
          context.report({ node, messageId: "tooLarge", data: { lines } });
        }
      },
    };
  },
};

export = rule;
