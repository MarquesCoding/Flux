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
    expect(stylesheet).toContain('--bloom-strength: 0.9');
    expect(stylesheet).toContain('--bloom-strength: 1');
    expect(stylesheet).toContain('opacity: var(--bloom-strength)');
  });

  it('draws every floating surface flat, in one colour with a hairline and a shadow', () => {
    const float = /\.valence-float \{([^}]*)\}/.exec(stylesheet)?.[1] ?? '';

    expect(float).toContain('background-color: var(--color-surface-raised)');
    expect(float).toContain('var(--surface-line)');
    expect(float).toContain('var(--shadow-overlay)');
  });

  it('paints a card in two layers, a tinted shell and a face set into it', () => {
    expect(stylesheet).toContain('.valence-card-shell');
    expect(stylesheet).toContain('.valence-card-face');
    expect(stylesheet).toContain('--card-shell:');
    expect(stylesheet).toContain('--card-face:');
  });

  it('grows the page with the window only from 1920 pixels up, and not without limit', () => {
    expect(stylesheet).toContain('font-size: clamp(1rem, 0.8333vw, 1.75rem)');
  });

  it("sets Gilroy's lettering in the middle of its line, where every weight sat high", () => {
    expect(stylesheet.match(/ascent-override: 82%/g)).toHaveLength(6);
    expect(stylesheet.match(/descent-override: 18%/g)).toHaveLength(6);
  });

  it('lets a change of theme be uncovered rather than cross-faded, only while it happens', () => {
    expect(stylesheet).toContain(':root[data-theme-shift]::view-transition-new(root)');
  });

  it('carries none of the raised, glossy or second-tone styles the interface has moved past', () => {
    for (const gone of [
      'valence-raise',
      '--raise-',
      '--glass-popover',
      'valence-glass--popover',
      'valence-glass--opaque',
      '--valence-icon-second-tone',
      'valence-dot-fill',
    ]) {
      expect(stylesheet).not.toContain(gone);
    }
  });
});

describe('the page the rows ride up on', () => {
  it('fades its sheet in as the rows rise, clear over the hero at the top of the page', () => {
    const fill = /\.valence-sheet::before \{([^}]*)\}/.exec(stylesheet)?.[1] ?? '';
    const sheet = /\.valence-sheet \{([^}]*)\}/.exec(stylesheet)?.[1] ?? '';

    expect(fill).toContain('opacity: var(--content-reach, 1)');
    expect(fill).toContain('background-color: var(--color-surface)');
    expect(fill).toContain('box-shadow: var(--shadow-sheet)');
    expect(sheet).not.toContain('background-color');
  });
});

describe('focus', () => {
  it('draws no ring around whatever has focus, the ring colour being transparent', () => {
    expect(stylesheet).toContain('--color-ring: transparent');
  });
});
