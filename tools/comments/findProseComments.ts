type ProseComment = {
  line: number;
  column: number;
  endLine: number;
  text: string;
};

type Language = 'rust' | 'css';

/**
 * Decides whether a comment is one its language is allowed to keep. Rust keeps its doc comments and
 * the safety notes clippy demands on unsafe blocks; every language keeps the directives that are
 * instructions to tooling rather than prose for a reader.
 *
 * @param language - The language the file is written in.
 * @param text - The comment, as written.
 * @returns Whether to leave it where it is.
 */
const isKept = (language: Language, text: string): boolean => {
  if (language === 'css') {
    return false;
  }

  return text.startsWith('///') || text.startsWith('//!') || text.startsWith('// SAFETY:');
};

/**
 * Finds where a line stops being code and starts being a comment, reading the line character by
 * character so that a comment marker inside a string literal is left alone. Pattern matching cannot
 * tell those apart, and a URL in a string looks exactly like the start of a comment.
 *
 * @param line - The line of source to read.
 * @param language - The language, which decides what opens a comment.
 * @returns The column the comment starts at, or null where the line holds none.
 */
const commentStartsAt = (line: string, language: Language): number => {
  let quote: string | null = null;

  for (let at = 0; at < line.length; at += 1) {
    const here = line[at] ?? '';
    const next = line[at + 1] ?? '';

    if (quote !== null) {
      if (here === '\\') {
        at += 1;
      } else if (here === quote) {
        quote = null;
      }

      continue;
    }

    if (here === '"' || here === "'") {
      quote = here;

      continue;
    }

    if (language === 'rust' && here === '/' && next === '/') {
      return at;
    }

    if (here === '/' && next === '*') {
      return at;
    }
  }

  return -1;
};

/**
 * Finds every comment in a file that is prose rather than something the language or the tooling
 * needs, for the languages ESLint cannot reach. Reports where each one begins and ends so a caller
 * can remove it without disturbing anything around it.
 *
 * @param source - The file to read.
 * @param language - The language it is written in.
 * @returns Each prose comment, with its position.
 */
const findProseComments = (source: string, language: Language): ProseComment[] => {
  const found: ProseComment[] = [];
  const lines = source.split('\n');
  let opened: ProseComment | null = null;

  for (const [index, line] of lines.entries()) {
    if (opened !== null) {
      if (line.includes('*/')) {
        found.push({ ...opened, endLine: index + 1 });
        opened = null;
      }

      continue;
    }

    const at = commentStartsAt(line, language);

    if (at === -1) {
      continue;
    }

    const text = line.slice(at).trim();
    const comment = { line: index + 1, column: at, endLine: index + 1, text };
    const opensBlock = text.startsWith('/*') && !text.includes('*/');

    if (isKept(language, text)) {
      continue;
    }

    if (opensBlock) {
      opened = comment;

      continue;
    }

    found.push(comment);
  }

  return found;
};

export { findProseComments };
export type { ProseComment, Language };
