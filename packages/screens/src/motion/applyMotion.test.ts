import { describe, expect, it } from 'vitest';
import { applyMotion } from './applyMotion';

describe('applyMotion', () => {
  it('marks the document with a choice to be still', () => {
    const root = document.createElement('div');

    applyMotion('reduced', root);

    expect(root.dataset['motion']).toBe('reduced');
  });

  it('marks a choice to move anyway, which the stylesheet needs in order to overrule the machine', () => {
    const root = document.createElement('div');

    applyMotion('full', root);

    expect(root.dataset['motion']).toBe('full');
  });

  it('writes nothing at all for following the machine', () => {
    const root = document.createElement('div');

    applyMotion('reduced', root);
    applyMotion('system', root);

    expect(root.dataset['motion']).toBeUndefined();
  });

  it('leaves nothing behind on a document that was never marked', () => {
    const root = document.createElement('div');

    applyMotion('system', root);

    expect(root.hasAttribute('data-motion')).toBe(false);
  });
});
