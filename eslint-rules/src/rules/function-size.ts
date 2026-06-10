import { Rule } from "eslint";

type Options = [{ max?: number }?];

const rule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce maximum function size (lines)",
      recommended: false,
    },
    messages: {
      tooLarge: "Function '{{name}}' is too large ({{lines}} lines). Consider refactoring.",
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
    const max = (opts && opts[0] && opts[0].max) || 100;

    function checkNode(node: any, name?: string | null) {
      if (!node || !node.loc) return;
      const lines = node.loc.end.line - node.loc.start.line + 1;
      if (lines > max) {
        context.report({
          node,
          messageId: "tooLarge",
          data: { name: name || "<anonymous>", lines },
        });
      }
    }

    return {
      FunctionDeclaration(node) {
        // @ts-ignore
        checkNode(node, node.id && node.id.name);
      },
      FunctionExpression(node) {
        // @ts-ignore
        checkNode(node, node.id && node.id.name);
      },
      ArrowFunctionExpression(node) {
        // Try to guess a name from parent if available
        // @ts-ignore
        const parent = node.parent;
        let name = null;
        if (parent) {
          // variable assignment: const foo = () => {}
          // @ts-ignore
          if (parent.type === "VariableDeclarator" && parent.id && parent.id.name)
            name = parent.id.name;
          // property assignment: obj = { foo: () => {} }
          // @ts-ignore
          if (parent.type === "Property" && parent.key && parent.key.name) name = parent.key.name;
        }
        checkNode(node, name);
      },
      MethodDefinition(node) {
        // class methods
        // @ts-ignore
        if (node.value) checkNode(node.value, node.key && node.key.name);
      },
    };
  },
};

export = rule;
