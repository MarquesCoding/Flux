import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { findProseComments } from './findProseComments';
import type { Language, ProseComment } from './findProseComments';

const ROOT = join(import.meta.dirname, '..', '..');

const SKIPPED = new Set(['node_modules', 'target', 'dist', '.git', '.turbo', '.astro', 'coverage']);

const LANGUAGES: Record<string, Language> = {
  '.rs': 'rust',
  '.css': 'css',
};

/**
 * Walks a directory and every directory below it, gathering the files worth checking and stepping
 * over the ones nothing is ever written in — dependencies, build output and version control.
 *
 * @param directory - Where to start walking.
 * @returns Every file found, as paths.
 */
const filesUnder = (directory: string): string[] => {
  const found: string[] = [];

  for (const entry of readdirSync(directory)) {
    if (SKIPPED.has(entry)) {
      continue;
    }

    const path = join(directory, entry);

    if (statSync(path).isDirectory()) {
      found.push(...filesUnder(path));

      continue;
    }

    found.push(path);
  }

  return found;
};

const languageOf = (path: string): Language | null => {
  const extension = Object.keys(LANGUAGES).find((candidate) => path.endsWith(candidate));

  return extension === undefined ? null : (LANGUAGES[extension] ?? null);
};

const isFixing = process.argv.includes('--fix');

/**
 * Rewrites a file with its prose comments removed. Cuts are made back to front so that the line
 * numbers found earlier still mean what they said, and a line left holding nothing but the comment
 * goes with it rather than being left blank.
 *
 * @param source - The file as it stands.
 * @param comments - Where each prose comment starts and ends.
 * @returns The file without them.
 */
const withoutComments = (source: string, comments: ProseComment[]): string => {
  const lines = source.split('\n');

  for (const comment of [...comments].reverse()) {
    const opening = lines[comment.line - 1] ?? '';
    const kept = opening.slice(0, comment.column).trimEnd();
    const isAlone = kept === '';

    lines.splice(comment.line - 1, comment.endLine - comment.line + 1, ...(isAlone ? [] : [kept]));
  }

  return lines.join('\n');
};

let count = 0;

for (const path of filesUnder(ROOT)) {
  const language = languageOf(path);

  if (language === null) {
    continue;
  }

  const source = readFileSync(path, 'utf8');
  const comments = findProseComments(source, language);

  if (comments.length === 0) {
    continue;
  }

  if (isFixing) {
    writeFileSync(path, withoutComments(source, comments));
  }

  for (const comment of comments) {
    process.stdout.write(
      `${relative(ROOT, path)}:${comment.line.toString()}  ${comment.text.slice(0, 90)}\n`,
    );
    count += 1;
  }
}

if (isFixing) {
  process.stdout.write(`\n${count.toString()} comments removed.\n`);
  process.exit(0);
}

if (count > 0) {
  process.stdout.write(
    `\n${count.toString()} comments. Code standards section 6: say it in a name, or in documentation on the declaration.\n`,
  );
  process.exit(1);
}
