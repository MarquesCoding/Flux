import { describe, expect, it } from 'vitest';
import { findProseComments } from './findProseComments';

describe('findProseComments', () => {
  it('finds a line comment in Rust', () => {
    expect(findProseComments('let x = 1; // why\n', 'rust')).toHaveLength(1);
  });

  it('keeps Rust doc comments, which are the crate’s published documentation', () => {
    expect(findProseComments('/// What this does.\npub fn go() {}\n', 'rust')).toHaveLength(0);
  });

  it('keeps module documentation', () => {
    expect(findProseComments('//! About this module.\n', 'rust')).toHaveLength(0);
  });

  it('keeps the safety note clippy demands on an unsafe block', () => {
    expect(findProseComments('// SAFETY: the pointer is owned here.\n', 'rust')).toHaveLength(0);
  });

  it('leaves a URL inside a string alone, which is the whole reason for parsing', () => {
    expect(findProseComments('let url = "https://example.com/a";\n', 'rust')).toHaveLength(0);
  });

  it('leaves a slash-star inside a string alone', () => {
    expect(findProseComments('let pattern = "/* not a comment";\n', 'rust')).toHaveLength(0);
  });

  it('still finds a comment after a string on the same line', () => {
    const found = findProseComments('let url = "https://example.com"; // why\n', 'rust');

    expect(found).toHaveLength(1);
    expect(found[0]?.text).toBe('// why');
  });

  it('reports a block comment once, at the line it opens on', () => {
    const found = findProseComments('/*\n * spread over\n * several lines\n */\nbody {}\n', 'css');

    expect(found).toHaveLength(1);
    expect(found[0]?.line).toBe(1);
  });

  it('finds a single-line block comment', () => {
    expect(findProseComments('body {} /* why */\n', 'css')).toHaveLength(1);
  });

  it('keeps nothing in CSS, since nothing generates documentation from it', () => {
    expect(findProseComments('/** looks like tsdoc */\nbody {}\n', 'css')).toHaveLength(1);
  });

  it('says which line a comment is on', () => {
    expect(findProseComments('a\nb\n// here\n', 'rust')[0]?.line).toBe(3);
  });

  it('finds nothing in a file that has nothing', () => {
    expect(findProseComments('fn main() {}\n', 'rust')).toEqual([]);
  });

  it('does not read a comment out of code that follows a block comment', () => {
    expect(findProseComments('/* gone */\nbody { color: red; }\n', 'css')).toHaveLength(1);
  });
});
