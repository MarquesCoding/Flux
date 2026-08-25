import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync('src/styles/valence.css', 'utf8');

describe('the Valence stylesheet', () => {
  it('tells Tailwind where ValenceUI lives', () => {
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

  it('tells the browser which theme is on, so native controls follow it', () => {
    expect(stylesheet).toContain('color-scheme: light');
    expect(stylesheet).toContain('color-scheme: dark');
  });

  it('gives glass over film the scrim palette rather than the page one', () => {
    const film = /\.valence-glass--film \{([^}]*)\}/.exec(stylesheet)?.[1] ?? '';

    expect(film).toContain('--color-text: var(--color-on-scrim)');
    expect(film).toContain('--color-foreground: var(--color-on-scrim)');
    expect(film).toContain('--color-text-muted:');
  });

  it('scales the blooms by theme, a glow over black being a wash over white', () => {
    expect(stylesheet).toContain('--bloom-strength: 0.4');
    expect(stylesheet).toContain('--bloom-strength: 1');
    expect(stylesheet).toContain('opacity: var(--bloom-strength)');
  });
});
