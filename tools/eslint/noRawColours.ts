import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

const RAW_UTILITY =
  /\b(?:bg|text|border|ring|divide|from|via|to|fill|stroke|shadow|outline|accent|caret|decoration)-(?:white|black)(?:\/\d{1,3}|\/\[[^\]]+\])?\b/u;

const RAW_VALUE = /(?:#[0-9a-fA-F]{3,8}\b|(?<![a-zA-Z])(?:rgba?|hsla?|oklch|oklab)\()/u;

const ALLOWED_IN = /\.(?:test|stories)\.[jt]sx?$|[\\/]styles[\\/]|[\\/]tokens[\\/]/u;

const createRule = ESLintUtils.RuleCreator(() => 'https://valence.local/no-raw-colours');

/**
 * Reads a string literal or a template chunk, whichever the node happens to be.
 *
 * @param node - The node to read.
 * @returns Its text, or nothing where it carries none.
 */
const textOf = (node: TSESTree.Node): string | null => {
  if (node.type === AST_NODE_TYPES.Literal) {
    return typeof node.value === 'string' ? node.value : null;
  }

  return node.type === AST_NODE_TYPES.TemplateElement ? node.value.raw : null;
};

const noRawColours = createRule({
  name: 'no-raw-colours',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Colours come from the palette, so that both themes are drawn by one set of rules.',
    },
    messages: {
      utility:
        'Use a palette class rather than {{ found }}. A colour written into a component is a colour only one theme is right about — see the tokens in valence.css.',
      value:
        'Use a palette class rather than the literal colour {{ found }}. Anything the palette cannot say yet belongs in valence.css as a token.',
    },
    schema: [],
  },
  defaultOptions: [],
  create: (context: Readonly<TSESLint.RuleContext<'utility' | 'value', []>>) => {
    if (ALLOWED_IN.test(context.filename)) {
      return {};
    }

    const look = (node: TSESTree.Node): void => {
      const text = textOf(node);

      if (text === null) {
        return;
      }

      const utility = RAW_UTILITY.exec(text);

      if (utility !== null) {
        context.report({ node, messageId: 'utility', data: { found: utility[0] } });

        return;
      }

      const value = RAW_VALUE.exec(text);

      if (value !== null) {
        context.report({ node, messageId: 'value', data: { found: value[0] } });
      }
    };

    return {
      Literal: look,
      TemplateElement: look,
    };
  },
});

export { noRawColours };
