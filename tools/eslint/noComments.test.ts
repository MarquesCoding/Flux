import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';
import { noComments } from './noComments';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  linterOptions: { reportUnusedDisableDirectives: 'off' },
});

ruleTester.run('no-comments', noComments, {
  valid: [
    { code: '// prettier-ignore\nconst rows = [1, 2];' },
    { code: '/**\n * Names a language.\n */\nconst nameLanguage = (code: string) => code;' },
    { code: '/**\n * Names a language.\n */\nexport const nameLanguage = (code: string) => code;' },
    {
      code: '/**\n * Names a language.\n */\nfunction nameLanguage(code: string) {\n  return code;\n}',
    },
    {
      code: '/**\n * Names a language.\n *\n * @param code - The tag as the file carried it.\n */\nconst nameLanguage = (code: string) => code;',
    },
    { code: 'const READ_EVERY = 10;' },
    {
      code: '// eslint-disable-next-line no-console -- the tool prints its findings\nconsole.log(1);',
    },
    { code: '/// <reference types="vite/client" />' },
  ],
  invalid: [
    {
      code: '/**\n * How often a position is sent.\n */\nconst REPORT_EVERY = 10;',
      output: 'const REPORT_EVERY = 10;',
      errors: [{ messageId: 'floatingDoc' }],
    },
    {
      code: '/**\n * Where somebody is.\n */\ntype Place = { section: string };',
      output: 'type Place = { section: string };',
      errors: [{ messageId: 'floatingDoc' }],
    },
    {
      code: 'type Place = {\n  /**\n   * Which section.\n   */\n  section: string;\n};',
      output: 'type Place = {\n  section: string;\n};',
      errors: [{ messageId: 'floatingDoc' }],
    },
    {
      code: 'const nameLanguage = (code: string) => {\n  /**\n   * The tag, lowered.\n   */\n  return code.toLowerCase();\n};',
      output: 'const nameLanguage = (code: string) => {\n  return code.toLowerCase();\n};',
      errors: [{ messageId: 'floatingDoc' }],
    },
    {
      code: '// lowers the tag\nconst nameLanguage = (code: string) => code;',
      output: 'const nameLanguage = (code: string) => code;',
      errors: [{ messageId: 'prose' }],
    },
    {
      code: '// eslint-disable-next-line no-console\nconst rows = [1, 2];',
      errors: [{ messageId: 'noReason' }],
    },
  ],
});
