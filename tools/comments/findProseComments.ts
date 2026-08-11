type ProseComment = {
  line: number;
  /**
   * Where on the line the comment opens, so a caller can remove it without
   * taking the code that shares the line with it.
   */
  column: number;
  /**
   * The line it closes on, which differs from `line` only for a block comment.
   */
  endLine: number;
  text: string;
};

type Language = 'rust' | 'css';

/**
 * The comments each language keeps.
 *
 * Rust doc comments are the published API of a crate and are required by the
 * standard, and `// SAFETY:` is required by clippy on every `unsafe` block. A
 * CSS file has no such thing: nothing generates documentation from it.
 */
const isKept = (language: Language, text: string): boolean => {
  if (language === 'css') {
    return false;
  }

  return text.startsWith('///') || text.startsWith('//!') || text.startsWith('// SAFETY:');
};

/**
 * Where a line's code ends and a comment begins, ignoring anything inside a
 * string.
 *
 * A URL in a string literal is not a comment, and neither is a `/*` in a
 * content property. Walking the line one character at a time is the only way to
 * tell the difference; a regular expression cannot, and one that tries deletes
 * somebody's `"https://…"` the first time it is run.
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
 * Every comment in a file that is prose rather than documentation.
 *
 * Reads the file rather than pattern-matching it, so a `//` inside a string
 * stays where it is. Block comments are reported at the line they open on and
 * counted once however many lines they run to.
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
