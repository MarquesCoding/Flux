import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readStyleSources } from './readStyleSources';

const ROOT = resolve(import.meta.dirname, '..', '..');

const aStylesheetSaying = (css: string): string => {
  const file = join(mkdtempSync(join(tmpdir(), 'flux-css-')), 'main.css');

  writeFileSync(file, css);

  return file;
};

describe('readStyleSources', () => {
  it('finds the paths a stylesheet asks Tailwind to scan', () => {
    const file = aStylesheetSaying("@import 'tailwindcss';\n@source '../elsewhere';\n");

    expect(readStyleSources(file)).toEqual(['../elsewhere']);
  });

  it('answers with nothing where a stylesheet names none', () => {
    expect(readStyleSources(aStylesheetSaying("@import 'tailwindcss';\n"))).toEqual([]);
  });
});

describe('the web stylesheet', () => {
  const stylesheet = join(ROOT, 'apps', 'web', 'src', 'styles', 'main.css');

  it('scans the screens, which Tailwind cannot find on its own', () => {
    const scanned = readStyleSources(stylesheet).map((path) =>
      resolve(ROOT, 'apps', 'web', 'src', 'styles', path),
    );

    expect(scanned).toContain(join(ROOT, 'packages', 'screens', 'src'));
  });

  it('names only paths that exist, so a move cannot leave one dangling', () => {
    for (const path of readStyleSources(stylesheet)) {
      expect(existsSync(resolve(ROOT, 'apps', 'web', 'src', 'styles', path))).toBe(true);
    }
  });
});
