import { describe, expect, it } from 'vitest';
import { POPUP_MOTION } from './popup';

describe('POPUP_MOTION', () => {
  it('grows from the edge it is anchored to rather than from its own middle', () => {
    expect(POPUP_MOTION).toContain('origin-[var(--transform-origin)]');
  });

  it('arrives small and see-through', () => {
    expect(POPUP_MOTION).toContain('data-[starting-style]:scale-95');
    expect(POPUP_MOTION).toContain('data-[starting-style]:opacity-0');
  });

  it('leaves the way it came, so shutting is not a disappearance', () => {
    expect(POPUP_MOTION).toContain('data-[ending-style]:scale-95');
    expect(POPUP_MOTION).toContain('data-[ending-style]:opacity-0');
  });

  it('moves at the platform’s own pace rather than a number picked here', () => {
    expect(POPUP_MOTION).toContain('duration-[var(--duration-base)]');
    expect(POPUP_MOTION).toContain('ease-[var(--ease-soft)]');
  });
});
