import { describe, expect, it } from 'vitest';
import { insideTheBook, packagePathIn, readEpubPackage } from './readEpubPackage';

const A_PACKAGE = `<?xml version="1.0"?>
<package version="3.0">
  <metadata>
    <dc:title>Moby-Dick</dc:title>
    <dc:creator>Herman Melville</dc:creator>
    <dc:creator>A Translator</dc:creator>
  </metadata>
  <manifest>
    <item id="one" href="text/one.xhtml" media-type="application/xhtml+xml"/>
    <item id="two" href="text/two.xhtml" media-type="application/xhtml+xml"/>
    <item id="pic" href="images/whale.png" media-type="image/png"/>
    <item id="css" href="style.css" media-type="text/css"/>
  </manifest>
  <spine>
    <itemref idref="one"/>
    <itemref idref="two"/>
  </spine>
</package>`;

describe('packagePathIn', () => {
  it('finds the package a container points at', () => {
    const container =
      '<container><rootfiles><rootfile full-path="OEBPS/content.opf" /></rootfiles></container>';

    expect(packagePathIn(container)).toBe('OEBPS/content.opf');
  });

  it('says nothing where the container names none', () => {
    expect(packagePathIn('<container></container>')).toBeNull();
  });
});

describe('insideTheBook', () => {
  it('resolves a path against the folder the package sits in', () => {
    expect(insideTheBook('OEBPS', 'text/one.xhtml')).toBe('OEBPS/text/one.xhtml');
  });

  it('follows a step back up, which a book may legitimately take', () => {
    expect(insideTheBook('OEBPS/text', '../images/one.png')).toBe('OEBPS/images/one.png');
  });

  it('drops the part of an address after a hash, which names a place in a document', () => {
    expect(insideTheBook('OEBPS', 'text/one.xhtml#chapter-2')).toBe('OEBPS/text/one.xhtml');
  });

  it('refuses to climb out of the book, which is the only thing it may name', () => {
    expect(insideTheBook('OEBPS', '../../../etc/passwd')).toBeNull();
  });
});

describe('readEpubPackage', () => {
  it('reads what the book is called', () => {
    expect(readEpubPackage('OEBPS/content.opf', A_PACKAGE).title).toBe('Moby-Dick');
  });

  it('reads everybody it says wrote it', () => {
    expect(readEpubPackage('OEBPS/content.opf', A_PACKAGE).authors).toEqual([
      'Herman Melville',
      'A Translator',
    ]);
  });

  it('reads the order it is read in, and only the parts that are read', () => {
    const read = readEpubPackage('OEBPS/content.opf', A_PACKAGE);

    expect(read.spine.map((part) => part.href)).toEqual([
      'OEBPS/text/one.xhtml',
      'OEBPS/text/two.xhtml',
    ]);
  });

  it('keeps the pictures in the manifest, which the spine does not list', () => {
    expect(
      readEpubPackage('OEBPS/content.opf', A_PACKAGE).manifest.get('OEBPS/images/whale.png'),
    ).toBe('image/png');
  });

  it('reads a book whose package sits at the root of the archive', () => {
    const read = readEpubPackage('content.opf', A_PACKAGE);

    expect(read.spine[0]?.href).toBe('text/one.xhtml');
  });

  it('says a book with no spine has no parts, rather than inventing them', () => {
    expect(readEpubPackage('content.opf', '<package></package>').spine).toEqual([]);
  });
});
