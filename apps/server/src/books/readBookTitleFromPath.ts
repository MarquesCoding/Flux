import { findYear } from '@FluxServer/library/readTitleFromPath';
import { bookFormatOf } from './openBookFile';

const BRACKETED = /[([{][^)\]}]*[)\]}]/g;

const CHAPTER_MARKER = /\b(?:ch(?:apter)?|vol(?:ume)?|[cv])[\s._-]*\d{1,4}(?:\.\d{1,2})?\b.*$/i;

const SEPARATORS = /[\s._]+/g;

const TRAILING = /[\s._\-–—:]+$/;

/**
 * Reads what a book is called, out of the folder or file it was found in.
 *
 * What is thrown away is everything in brackets. Comics are distributed with their provenance in the
 * name — who scanned them, whether they were bought or ripped, which release this is — and none of
 * it is the title: `Rent-A-Girlfriend (Digital) (Sticky Oak)` is a book called Rent-A-Girlfriend.
 *
 * The year is kept where one was in there, because a book has one and the shelf shows it.
 *
 * Anything from a chapter or volume marker onwards goes too, so that a loose file with no folder
 * around it still gives its book a name rather than a name with a number stuck to it.
 *
 * Only a known ending is treated as one. A title is full of full stops — `Ore.wa.Gimai.ni.Uso` is
 * how a filename writes spaces — and taking the last of them for an extension loses the last word.
 * Hyphens are left where they are for the same reason: Rent-A-Girlfriend is spelt that way.
 *
 * @param name - The folder's name, or the file's where it has no folder.
 * @returns What to call the book, and the year where the name carried one.
 */
const readBookTitleFromPath = (name: string): { title: string; year: number | null } => {
  const withoutExtension =
    bookFormatOf(name) === null ? name : name.slice(0, name.lastIndexOf('.'));
  const found = findYear(withoutExtension);
  const withoutBrackets = withoutExtension.replaceAll(BRACKETED, ' ');
  const withoutNumbering = withoutBrackets.replace(CHAPTER_MARKER, ' ');
  const tidied = withoutNumbering.replaceAll(SEPARATORS, ' ').replace(TRAILING, '').trim();

  return {
    title: tidied === '' ? withoutExtension.trim() : tidied,
    year: found?.year ?? null,
  };
};

export { readBookTitleFromPath };
