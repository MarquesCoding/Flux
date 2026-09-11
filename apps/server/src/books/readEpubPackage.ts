const ROOT_FILE = /<rootfile\b[^>]*\bfull-path\s*=\s*"([^"]+)"/i;

const MANIFEST_ITEM = /<item\b[^>]*>/gi;

const SPINE_ITEM = /<itemref\b[^>]*>/gi;

const TITLE = /<dc:title\b[^>]*>([^<]*)<\/dc:title>/i;

const CREATOR = /<dc:creator\b[^>]*>([^<]*)<\/dc:creator>/gi;

const DESCRIPTION = /<dc:description\b[^>]*>([^<]*)<\/dc:description>/i;

type EpubPackage = {
  title: string | null;
  authors: string[];
  description: string | null;
  spine: { href: string; mediaType: string }[];
  manifest: Map<string, string>;
};

/**
 * Reads one attribute off a tag.
 *
 * @param tag - The tag, as it was written.
 * @param name - The attribute wanted.
 * @returns Its value, or nothing where the tag does not carry it.
 */
const attribute = (tag: string, name: string): string | null => {
  const found = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag);

  return found?.[1] ?? null;
};

/**
 * Resolves a path written relative to the package document against the archive it lives in.
 *
 * A book's package sits in a folder of its own more often than not, and everything it names is named
 * relative to itself, so a chapter listed as `text/one.xhtml` is `OEBPS/text/one.xhtml` in the
 * archive. Anything climbing out of the archive with `..` is refused rather than resolved: a book is
 * a file from a stranger, and the only thing it may name is itself.
 *
 * @param base - Where the package document sits.
 * @param href - What it named.
 * @returns The path inside the archive, or nothing where it named somewhere it may not.
 */
const insideTheBook = (base: string, href: string): string | null => {
  const at = href.split(/[#?]/)[0] ?? '';
  const parts = base === '' ? [] : base.split('/');
  const resolved: string[] = [...parts];

  for (const step of at.split('/')) {
    if (step === '' || step === '.') {
      continue;
    }

    if (step === '..') {
      if (resolved.length === 0) {
        return null;
      }

      resolved.pop();

      continue;
    }

    resolved.push(step);
  }

  return resolved.length === 0 ? null : resolved.join('/');
};

/**
 * Reads what a book says it is: what it is called, who wrote it, and the order its parts are read.
 *
 * An EPUB names itself twice over — a container pointing at a package document, and a package
 * document listing every file and then, separately, the order of the ones that are chapters. Both
 * are machine-written and narrow, so they are read with patterns rather than by pulling in an XML
 * parser for two shapes.
 *
 * The spine is the order, and it is the only order: the manifest lists the pictures and stylesheets
 * too, and a reader that walked it would open on a font.
 *
 * @param container - The `META-INF/container.xml` document.
 * @param packageAt - Where the package document sits inside the archive.
 * @param packageXml - The package document.
 * @returns What the book says about itself.
 */
const readEpubPackage = (packageAt: string, packageXml: string): EpubPackage => {
  const base = packageAt.includes('/') ? packageAt.slice(0, packageAt.lastIndexOf('/')) : '';
  const manifest = new Map<string, string>();
  const byId = new Map<string, { href: string; mediaType: string }>();

  for (const [tag] of packageXml.matchAll(MANIFEST_ITEM)) {
    const id = attribute(tag, 'id');
    const href = attribute(tag, 'href');
    const mediaType = attribute(tag, 'media-type') ?? 'application/octet-stream';

    if (id === null || href === null) {
      continue;
    }

    const inside = insideTheBook(base, href);

    if (inside === null) {
      continue;
    }

    manifest.set(inside, mediaType);
    byId.set(id, { href: inside, mediaType });
  }

  const spine: { href: string; mediaType: string }[] = [];

  for (const [tag] of packageXml.matchAll(SPINE_ITEM)) {
    const id = attribute(tag, 'idref');
    const found = id === null ? undefined : byId.get(id);

    if (found !== undefined) {
      spine.push(found);
    }
  }

  const authors: string[] = [];

  for (const [, name] of packageXml.matchAll(CREATOR)) {
    if (name !== undefined && name.trim() !== '') {
      authors.push(name.trim());
    }
  }

  const title = TITLE.exec(packageXml)?.[1]?.trim();
  const description = DESCRIPTION.exec(packageXml)?.[1]?.trim();

  return {
    title: title === undefined || title === '' ? null : title,
    authors,
    description: description === undefined || description === '' ? null : description,
    spine,
    manifest,
  };
};

/**
 * Finds the package document a container points at.
 *
 * @param containerXml - The `META-INF/container.xml` document.
 * @returns Where the package document is, or nothing where the container names none.
 */
const packagePathIn = (containerXml: string): string | null =>
  ROOT_FILE.exec(containerXml)?.[1] ?? null;

export type { EpubPackage };

export { insideTheBook, packagePathIn, readEpubPackage };
