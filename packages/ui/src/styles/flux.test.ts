import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Read through the working directory rather than import.meta.url, which under
// jsdom is an http URL the filesystem cannot open.
const stylesheet = readFileSync('src/styles/flux.css', 'utf8');

describe('the Flux stylesheet', () => {
  it('tells Tailwind where FluxUI lives', () => {
    // Automatic detection starts from the application that imports this file
    // and never reaches this package. Without a source declaration every class
    // used only inside FluxUI is absent from the generated stylesheet, and the
    // components render with no styling at all — which looks like a layout bug
    // rather than a missing stylesheet.
    expect(stylesheet).toMatch(/@source\s+'\.\.\/?'/);
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
