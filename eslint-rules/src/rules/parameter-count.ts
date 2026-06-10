import { Rule } from "eslint";

type Options = [{ max?: number }?];

const rule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce maximum parameter count",
      recommended: false,
    },
    messages: {
      tooMany: "Function '{{name}}' has too many parameters ({{count}}). Max allowed is {{max}}.",
    },
    schema: [
      {
        type: "object",
        properties: { max: { type: "number" } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const opts: Options = context.options as any;
    const max = (opts && opts[0] && opts[0].max) || 4;

    function check(node: any, name?: string | null) {
      const params = node.params || [];
      const count = params.length;
      if (count > max) {
        context.report({
          node,
          messageId: "tooMany",
          data: { name: name || "<anonymous>", count, max },
        });
      }
    }

    return {
      FunctionDeclaration(node: any) {
        check(node, node.id && node.id.name);
      },
      FunctionExpression(node: any) {
        check(node, node.id && node.id.name);
      },
      ArrowFunctionExpression(node: any) {
        const parent = node.parent;
        let name: string | null = null;
        if (parent && parent.type === "VariableDeclarator" && parent.id && parent.id.name)
          name = parent.id.name;
        check(node, name);
      },
      MethodDefinition(node: any) {
        if (node.value) check(node.value, node.key && node.key.name);
      },
    };
  },
};

export = rule;
