import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openEpub } from './openEpub';

const say = (text: string): Uint8Array => new TextEncoder().encode(text);

const A_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7]);

const CONTAINER = say(
  '<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>',
);

const PACKAGE = say(`<package>
  <metadata><dc:title>Moby-Dick</dc:title><dc:creator>Herman Melville</dc:creator></metadata>
  <manifest>
    <item id="one" href="text/one.xhtml" media-type="application/xhtml+xml"/>
    <item id="two" href="text/two.xhtml" media-type="application/xhtml+xml"/>
    <item id="pic" href="images/whale.png" media-type="image/png"/>
  </manifest>
  <spine><itemref idref="one"/><itemref idref="two"/></spine>
</package>`);

const address = (href: string): string => `/served/${href}`;

let where = '';

let path = '';

const aBook = async (name: string, files: Record<string, Uint8Array>): Promise<string> => {
  const at = join(where, name);

  await writeFile(at, zipSync(files));

  return at;
};

beforeAll(async () => {
  where = await mkdtemp(join(tmpdir(), 'valence-epub-'));
  path = await aBook('moby.epub', {
    'META-INF/container.xml': CONTAINER,
    'OEBPS/content.opf': PACKAGE,
    'OEBPS/text/one.xhtml': say(
      '<html><body><p>Call me Ishmael.</p><script>alert(1)</script></body></html>',
    ),
    'OEBPS/text/two.xhtml': say(
      '<html><body><p>Some years ago.</p><img src="../images/whale.png"/></body></html>',
    ),
    'OEBPS/images/whale.png': A_PNG,
  });
});

afterAll(async () => {
  await rm(where, { recursive: true, force: true });
});

describe('openEpub', () => {
  it('opens as a book that reflows, since how many pages it makes is up to the screen', async () => {
    expect((await openEpub(path, address))?.layout).toBe('reflow');
  });

  it('reads the order it is read in', async () => {
    const book = await openEpub(path, address);

    expect(book?.spine.map((part) => part.href)).toEqual([
      'OEBPS/text/one.xhtml',
      'OEBPS/text/two.xhtml',
    ]);
  });

  it('names the parts by where they fall, since a spine says order and not names', async () => {
    expect((await openEpub(path, address))?.spine[0]?.title).toBe('Part 1');
  });

  it('reads a part, and cleans it on the way out', async () => {
    const document = await (await openEpub(path, address))?.readDocument('OEBPS/text/one.xhtml');

    expect(document).toContain('Call me Ishmael.');
    expect(document).not.toContain('script');
  });

  it('points a picture at Valence, resolved from where the part sits and not the book', async () => {
    const document = await (await openEpub(path, address))?.readDocument('OEBPS/text/two.xhtml');

    expect(document).toContain('/served/OEBPS/images/whale.png');
  });

  it('serves a picture the book holds', async () => {
    const picture = await (await openEpub(path, address))?.readResource('OEBPS/images/whale.png');

    expect(picture?.contentType).toBe('image/png');
    expect(picture?.bytes).toEqual(A_PNG);
  });

  it('will not serve something outside the book, however the address is written', async () => {
    const book = await openEpub(path, address);

    expect(await book?.readResource('../../../etc/passwd')).toBeNull();
  });

  it('says nothing of a part it does not hold', async () => {
    expect(await (await openEpub(path, address))?.readDocument('OEBPS/text/nine.xhtml')).toBeNull();
  });

  it('will not open an archive that is not a book', async () => {
    const wrong = await aBook('nothing.epub', { 'hello.txt': say('hello') });

    expect(await openEpub(wrong, address)).toBeNull();
  });

  it('will not open a book whose container points nowhere', async () => {
    const wrong = await aBook('lost.epub', {
      'META-INF/container.xml': say('<container></container>'),
    });

    expect(await openEpub(wrong, address)).toBeNull();
  });

  it('will not open a file that is not there', async () => {
    expect(await openEpub(join(where, 'missing.epub'), address)).toBeNull();
  });
});
