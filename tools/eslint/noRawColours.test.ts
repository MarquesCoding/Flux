import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';
import { noRawColours } from './noRawColours';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  linterOptions: { reportUnusedDisableDirectives: 'off' },
});

ruleTester.run('no-raw-colours', noRawColours, {
  valid: [
    { code: "const it = 'bg-primary text-primary-foreground';" },
    { code: "const it = 'bg-surface-raised ring-1 ring-line';" },
    { code: "const it = 'text-on-scrim/70 bg-shade/50';" },
    { code: "const it = 'bg-subtle hover:bg-hover data-[state=open]:bg-active';" },
    { code: "const it = 'border-divider divide-track';" },
    { code: "const it = 'bg-[var(--color-accent)]';" },
    { code: 'const it = `bg-${tone} text-text`;' },
    { code: "const it = 'whitespace-nowrap rounded-pill px-3';" },
    { filename: 'packages/ui/src/tokens/captionColours.ts', code: "const it = '#ffffff';" },
    { filename: 'packages/ui/src/styles/theme.ts', code: "const it = 'rgb(1 2 3)';" },
    { filename: 'a/b/Thing.test.tsx', code: "const it = 'bg-white';" },
  ],
  invalid: [
    { code: "const it = 'bg-white';", errors: [{ messageId: 'utility' }] },
    { code: "const it = 'text-white/70';", errors: [{ messageId: 'utility' }] },
    { code: "const it = 'bg-black/50';", errors: [{ messageId: 'utility' }] },
    { code: "const it = 'ring-white/10';", errors: [{ messageId: 'utility' }] },
    { code: "const it = 'from-black/80 to-black';", errors: [{ messageId: 'utility' }] },
    { code: "const it = 'divide-white/5';", errors: [{ messageId: 'utility' }] },
    { code: "const it = '#ffffff';", errors: [{ messageId: 'value' }] },
    { code: "const it = 'bg-[#0a0a0f]';", errors: [{ messageId: 'value' }] },
    { code: "const it = 'shadow-[0_1px_2px_rgba(0,0,0,0.4)]';", errors: [{ messageId: 'value' }] },
    { code: 'const it = `border-${side} bg-white`;', errors: [{ messageId: 'utility' }] },
  ],
});
