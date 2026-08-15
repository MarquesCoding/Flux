import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';
import type { TSESLint } from '@typescript-eslint/utils';

const DIRECTIVES = [
  'eslint-disable',
  'eslint-enable',
  'eslint-env',
  'oxlint-disable',
  'oxlint-enable',
  'global ',
  'globals ',
  'ts-expect-error',
  'ts-ignore',
  'ts-nocheck',
  'ts-check',
  'prettier-ignore',
  'v8 ignore',
  'c8 ignore',
  'istanbul ignore',
  '@vitest-environment',
  '@jsxImportSource',
  '@vite-ignore',
  'webpackChunkName',
] as const;

const DOCUMENTABLE = [
  'FunctionDeclaration',
  'TSDeclareFunction',
  'MethodDefinition',
  'TSMethodSignature',
] as const;

const TRIPLE_SLASH = /^\/\s*<(reference|amd-module|amd-dependency)\b/;

/**
 * Whether a comment is addressed to a tool.
 */
const isDirective = (text: string): boolean => {
  const trimmed = text.trim();

  return (
    TRIPLE_SLASH.test(trimmed) || DIRECTIVES.some((directive) => trimmed.startsWith(directive))
  );
};

/**
 * Whether a comment is TSDoc, which opens with a second asterisk.
 */
const isTsDoc = (comment: TSESTree.Comment): boolean =>
  comment.type === TSESTree.AST_TOKEN_TYPES.Block && comment.value.startsWith('*');

/**
 * Whether a lint directive says why it is there.
 */
const hasReason = (text: string): boolean => {
  const trimmed = text.trim();
  const isSilencing = trimmed.startsWith('eslint-disable') || trimmed.startsWith('oxlint-disable');

  return !isSilencing || trimmed.includes(' -- ');
};

const createRule = ESLintUtils.RuleCreator(
  () => 'https://github.com/MarquesCoding/StreamerApp/blob/main/docs/code-standards.md',
);

const noComments = createRule({
  name: 'no-comments',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Ban prose comments, allowing TSDoc on declarations and tool directives',
    },
    fixable: 'whitespace',
    schema: [],
    messages: {
      prose:
        'Comments are banned. Say it in a name, or in TSDoc on the declaration. See code standards section 6.',
      floatingDoc:
        'TSDoc belongs on a function, and nowhere else. A type, a constant or a property says what it is in its name and its type. See code standards section 6.',
      noReason: 'A lint directive must say why, after ` -- `. See code standards section 6.',
    },
  },
  defaultOptions: [],
  create(context) {
    const { sourceCode } = context;
    const documented = new Set<TSESTree.Comment>();

    /**
     * Removes the comment, and the JSX braces around it when they hold nothing else — `{}` on its
     * own is not valid where a comment container was.
     */
    const remove = (comment: TSESTree.Comment): TSESLint.ReportFixFunction => {
      return (fixer) => {
        const held = sourceCode.getNodeByRangeIndex(comment.range[0]);
        const container =
          held?.type === TSESTree.AST_NODE_TYPES.JSXEmptyExpression ? held.parent : held;
        const target =
          container?.type === TSESTree.AST_NODE_TYPES.JSXExpressionContainer ? container : comment;

        const [start, end] = target.range;
        const before = sourceCode.getText().slice(0, start);
        const lineStart = before.lastIndexOf('\n') + 1;
        const isAlone = before.slice(lineStart).trim() === '';
        const after = sourceCode.getText().slice(end);
        const lineEnd = after.indexOf('\n');
        const endsLine = lineEnd === -1 || after.slice(0, lineEnd).trim() === '';

        return fixer.removeRange(
          isAlone && endsLine
            ? [lineStart, end + (lineEnd === -1 ? 0 : lineEnd + 1)]
            : [start, end],
        );
      };
    };

    const visitor: TSESLint.RuleListener = {};

    for (const type of DOCUMENTABLE) {
      visitor[type] = (node: TSESTree.Node) => {
        for (const comment of sourceCode.getCommentsBefore(node)) {
          documented.add(comment);
        }
      };
    }

    visitor.VariableDeclaration = (node: TSESTree.VariableDeclaration) => {
      const [first] = node.declarations;
      const held = first.init?.type;

      if (
        held !== TSESTree.AST_NODE_TYPES.ArrowFunctionExpression &&
        held !== TSESTree.AST_NODE_TYPES.FunctionExpression
      ) {
        return;
      }

      const owner =
        node.parent.type === TSESTree.AST_NODE_TYPES.ExportNamedDeclaration ? node.parent : node;

      for (const comment of sourceCode.getCommentsBefore(owner)) {
        documented.add(comment);
      }
    };

    return {
      ...visitor,
      'Program:exit'() {
        for (const comment of sourceCode.getAllComments()) {
          if (isDirective(comment.value)) {
            if (!hasReason(comment.value)) {
              context.report({ node: comment, messageId: 'noReason' });
            }

            continue;
          }

          if (isTsDoc(comment)) {
            if (!documented.has(comment)) {
              context.report({ node: comment, messageId: 'floatingDoc', fix: remove(comment) });
            }

            continue;
          }

          context.report({ node: comment, messageId: 'prose', fix: remove(comment) });
        }
      },
    };
  },
});

export { noComments };
