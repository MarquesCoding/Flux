import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';
import type { TSESLint } from '@typescript-eslint/utils';

/**
 * The comments that are instructions to a tool rather than prose for a reader.
 *
 * A tool reads these; deleting one changes what the build does. They are the
 * only single-line comments the codebase keeps.
 */
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

/**
 * The declarations TSDoc is allowed to describe.
 *
 * TSDoc says what a thing is, so it belongs on something named. A comment
 * floating inside a function body describes a moment rather than a thing, and
 * is prose however it is punctuated.
 */
const DOCUMENTABLE = [
  'VariableDeclaration',
  'FunctionDeclaration',
  'ClassDeclaration',
  'TSTypeAliasDeclaration',
  'TSInterfaceDeclaration',
  'TSEnumDeclaration',
  'TSModuleDeclaration',
  'TSDeclareFunction',
  'ExportNamedDeclaration',
  'ExportDefaultDeclaration',
  'ExportAllDeclaration',
  'ImportDeclaration',
  'TSPropertySignature',
  'TSMethodSignature',
  'PropertyDefinition',
  'MethodDefinition',
] as const;

/**
 * A triple-slash directive, which is the only thing a third slash may mean.
 *
 * `/// <reference ... />` is read by the compiler. `/// anything else` is Rust
 * doc syntax written in the wrong language, and is prose wearing a third
 * slash — which is exactly how nine of them survived the first sweep.
 */
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
 *
 * A silenced rule with no reason is indistinguishable from a mistake, and
 * nobody who finds one later can tell whether it is safe to remove.
 */
const hasReason = (text: string): boolean => {
  const trimmed = text.trim();
  const isSilencing = trimmed.startsWith('eslint-disable') || trimmed.startsWith('oxlint-disable');

  return !isSilencing || trimmed.includes(' -- ');
};

const createRule = ESLintUtils.RuleCreator(
  () => 'https://github.com/MarquesCoding/StreamerApp/blob/main/docs/code-standards.md',
);

/**
 * Bans prose comments, keeping TSDoc on declarations and directives to tools.
 *
 * The rule exists because the standard was ignored: a codebase gathers
 * commentary faster than anyone removes it, and a comment beside code is a
 * second description of it that nothing keeps true. Code standards section 6
 * says what may stay; this says the same thing in a form that fails a build.
 */
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
        'TSDoc belongs on a declaration, not inside a body. See code standards section 6.',
      noReason: 'A lint directive must say why, after ` -- `. See code standards section 6.',
    },
  },
  defaultOptions: [],
  create(context) {
    const { sourceCode } = context;
    const documented = new Set<TSESTree.Comment>();

    /**
     * Removes the comment, and the JSX braces around it when they hold nothing
     * else — `{}` on its own is not valid where a comment container was.
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
