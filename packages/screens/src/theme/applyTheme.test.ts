import { describe, expect, it } from 'vitest';
import { applyTheme } from './applyTheme';

describe('applyTheme', () => {
  it('marks the document with a chosen theme', () => {
    const root = document.createElement('html');

    applyTheme('light', root);

    expect(root.dataset['theme']).toBe('light');
  });

  it('writes nothing at all where the machine is being followed', () => {
    const root = document.createElement('html');

    applyTheme('system', root);

    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('takes a mark off again when somebody goes back to following the machine', () => {
    const root = document.createElement('html');

    applyTheme('dark', root);
    applyTheme('system', root);

    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('changes its mind without leaving the old answer behind', () => {
    const root = document.createElement('html');

    applyTheme('dark', root);
    applyTheme('light', root);

    expect(root.dataset['theme']).toBe('light');
  });
});
