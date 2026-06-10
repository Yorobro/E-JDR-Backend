import { Rule } from "eslint";

const CAMEL_CASE = /^[a-z][a-zA-Z0-9]*$/;
const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/;

const rule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce simple naming conventions (camelCase for variables/functions, PascalCase for types/classes)",
      recommended: false,
    },
    messages: {
      shouldBeCamel: "Identifier '{{name}}' should be camelCase.",
      shouldBePascal: "Identifier '{{name}}' should be PascalCase.",
    },
    schema: [],
  },
  create(context) {
    function skip(name?: string) {
      if (!name) return true;
      if (name.startsWith("_")) return true; // allow intentional private/ignored names
      return false;
    }

    function checkCamel(name: string, node: any) {
      if (skip(name)) return;
      if (!CAMEL_CASE.test(name)) context.report({ node, messageId: "shouldBeCamel", data: { name } });
    }

    function checkPascal(name: string, node: any) {
      if (skip(name)) return;
      if (!PASCAL_CASE.test(name)) context.report({ node, messageId: "shouldBePascal", data: { name } });
    }

    return {
      VariableDeclarator(node: any) {
        const id = node.id;
        if (!id) return;
        if (id.type === "Identifier") checkCamel(id.name, node);
      },
      FunctionDeclaration(node: any) {
        if (node.id && node.id.name) checkCamel(node.id.name, node);
      },
      ClassDeclaration(node: any) {
        if (node.id && node.id.name) checkPascal(node.id.name, node);
      },
      TSInterfaceDeclaration(node: any) {
        if (node.id && node.id.name) checkPascal(node.id.name, node);
      },
      TSTypeAliasDeclaration(node: any) {
        if (node.id && node.id.name) checkPascal(node.id.name, node);
      },
      MethodDefinition(node: any) {
        if (!node.computed && node.key && node.key.type === "Identifier") checkCamel(node.key.name, node);
      },
    };
  },
};

export = rule;
