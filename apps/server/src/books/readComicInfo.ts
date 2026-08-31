import type { BookAbout } from './BookFile';

const COMIC_INFO = 'comicinfo.xml';

const TITLE = /<Title\b[^>]*>([^<]*)<\/Title>/i;

const SERIES = /<Series\b[^>]*>([^<]*)<\/Series>/i;

const SUMMARY = /<Summary\b[^>]*>([^<]*)<\/Summary>/i;

const WRITER = /<Writer\b[^>]*>([^<]*)<\/Writer>/i;

/**
 * Reads one tag's text out of a comic's own description of itself, treating an empty tag as an
 * absent one — plenty of writers of these files leave every tag in place and fill only some.
 *
 * @param pattern - The tag to read.
 * @param xml - The whole of `ComicInfo.xml`.
 * @returns What the tag said, or null where it said nothing.
 */
const textIn = (pattern: RegExp, xml: string): string | null => {
  const found = pattern.exec(xml)?.[1]?.trim();

  return found === undefined || found === '' ? null : found;
};

/**
 * Reads what a comic says about itself, out of the `ComicInfo.xml` its packer left inside it.
 *
 * The series is preferred over the title where both are given: a volume's `Title` is that volume's
 * own name where it has one, and the shelf is arranged by what the series is called.
 *
 * Only the writer is taken as an author. A comic credits a penciller, an inker, a colourist and a
 * letterer as well, and listing all of them under one heading would say less than naming nobody.
 *
 * @param xml - The whole of `ComicInfo.xml`.
 * @returns What it claimed, or null where it claimed nothing worth having.
 */
const readComicInfo = (xml: string): BookAbout | null => {
  const writers = textIn(WRITER, xml);

  const about = {
    title: textIn(SERIES, xml) ?? textIn(TITLE, xml),
    authors:
      writers === null
        ? []
        : writers
            .split(',')
            .map((name) => name.trim())
            .filter((name) => name !== ''),
    description: textIn(SUMMARY, xml),
  };

  return about.title === null && about.authors.length === 0 && about.description === null
    ? null
    : about;
};

export { COMIC_INFO, readComicInfo };
