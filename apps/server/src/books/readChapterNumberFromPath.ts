const CHAPTER_PATTERNS = [
  /\bch(?:apter)?[\s._-]*(\d{1,4}(?:\.\d{1,2})?)\b/i,
  /\bc(\d{2,4}(?:\.\d{1,2})?)\b/,
  /#\s*(\d{1,4}(?:\.\d{1,2})?)\b/,
] as const;

const VOLUME_PATTERNS = [
  /\bvol(?:ume)?[\s._-]*(\d{1,4}(?:\.\d{1,2})?)\b/i,
  /\bv(\d{1,4}(?:\.\d{1,2})?)\b/i,
] as const;

const A_YEAR = /^(?:1[5-9]|20)\d{2}$/;

const BARE_NUMBER = /(\d{1,4}(?:\.\d{1,2})?)/g;

/**
 * Reads which chapter a file is, out of what it is called.
 *
 * A chapter beats a volume where a name carries both, because somebody reading asks for the chapter
 * and the volume is only where it was printed. Where a name carries neither, the last number in it
 * is taken — but never a year, which is the number these names carry most often and mean least by:
 * the volumes this was built against are called `v05 (2021)`, and reading that as chapter 2021 would
 * put a library in the wrong order for ever.
 *
 * Halves are kept. A chapter published between two others is 10.5, which is why the number this
 * returns is not an integer.
 *
 * @param fileName - What the file is called, without its folder.
 * @returns Which chapter it is, or nothing where the name says nothing about it.
 */
const readChapterNumberFromPath = (fileName: string): number | null => {
  const withoutExtension = fileName.includes('.')
    ? fileName.slice(0, fileName.lastIndexOf('.'))
    : fileName;

  for (const pattern of CHAPTER_PATTERNS) {
    const found = pattern.exec(withoutExtension);
    const read = found?.[1] === undefined ? Number.NaN : Number.parseFloat(found[1]);

    if (!Number.isNaN(read)) {
      return read;
    }
  }

  for (const pattern of VOLUME_PATTERNS) {
    const found = pattern.exec(withoutExtension);
    const read = found?.[1] === undefined ? Number.NaN : Number.parseFloat(found[1]);

    if (!Number.isNaN(read)) {
      return read;
    }
  }

  const numbers = [...withoutExtension.matchAll(BARE_NUMBER)]
    .map((found) => found[1])
    .filter((text): text is string => text !== undefined && !A_YEAR.test(text));

  const last = numbers.at(-1);

  return last === undefined ? null : Number.parseFloat(last);
};

export { readChapterNumberFromPath };
