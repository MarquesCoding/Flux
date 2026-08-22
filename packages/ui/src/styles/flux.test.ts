import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync('src/styles/flux.css', 'utf8');

describe('the Valence stylesheet', () => {
  it('tells Tailwind where FluxUI lives', () => {
    expect(stylesheet).toMatch(/@source\s+'\.\.\/?'/);
  });

  it('reaches its fonts beside itself, so any host that imports it gets them', () => {
    expect(stylesheet).toContain("url('../fonts/");
    expect(stylesheet).not.toContain("url('/fonts/");
  });

  it('defines the tokens components are built from', () => {
    for (const token of ['--color-surface', '--color-accent', '--color-text', '--radius-md']) {
      expect(stylesheet).toContain(token);
    }
  });

  it('answers to an explicit theme choice as well as the system one', () => {
    expect(stylesheet).toContain("[data-theme='dark']");
    expect(stylesheet).toContain('prefers-color-scheme: dark');
  });
});
