import { readFileSync } from 'node:fs';

const SOURCE = /@source\s+'([^']+)'/g;

/**
 * Reads the paths a stylesheet tells Tailwind to scan for class names.
 *
 * @param file - The stylesheet to read.
 * @returns Every path named by an `@source`, in the order they appear.
 */
const readStyleSources = (file: string): string[] =>
  [...readFileSync(file, 'utf8').matchAll(SOURCE)].map((found) => found[1] ?? '');

export { readStyleSources };
