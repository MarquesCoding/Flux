import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aHeldFile, whatWasAsked, whichPart } from './aHeldFile';

const ID = '2b2b7f7e-2f0e-4a5e-9c2f-2b9b1e1f0a11';

const FILM = 'abcdefghij';

let folder = '';

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'valence-serving-'));

  await writeFile(join(folder, `${ID}.mp4`), FILM);
  await writeFile(join(folder, `${ID}.jpg`), 'an-image');
});

afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

describe('whatWasAsked', () => {
  it('reads a film out of an address', () => {
    expect(whatWasAsked('/held', `/held/${ID}`)?.kind).toBe('video/mp4');
  });

  it('reads its artwork out of one', () => {
    expect(whatWasAsked('/held', `/held/${ID}/poster`)?.kind).toBe('image/jpeg');
  });

  it('refuses an address that is not a held file', () => {
    expect(whatWasAsked('/held', '/api/media')).toBeNull();
  });

  it('refuses to be walked out of the folder', () => {
    expect(whatWasAsked('/held', '/held/../../../etc/passwd')).toBeNull();
  });

  it('refuses a name that is not a download id', () => {
    expect(whatWasAsked('/held', '/held/the-one-from-last-night')).toBeNull();
  });
});

describe('whichPart', () => {
  it('wants the whole file where nothing was asked for', () => {
    expect(whichPart(null, 10)).toBeNull();
  });

  it('reads a part with both ends stated', () => {
    expect(whichPart('bytes=2-5', 10)).toEqual({ from: 2, to: 5 });
  });

  it('reads an open-ended ask as everything from there on', () => {
    expect(whichPart('bytes=4-', 10)).toEqual({ from: 4, to: 9 });
  });

  it('reads an ask for the last few bytes, which is how a player finds the index', () => {
    expect(whichPart('bytes=-3', 10)).toEqual({ from: 7, to: 9 });
  });

  it('does not run off the end of the file', () => {
    expect(whichPart('bytes=8-100', 10)).toEqual({ from: 8, to: 9 });
  });

  it('treats an ask beginning past the end as an ask for the file', () => {
    expect(whichPart('bytes=50-60', 10)).toBeNull();
  });

  it('ignores a range it cannot read', () => {
    expect(whichPart('the middle bit', 10)).toBeNull();
  });
});

describe('aHeldFile', () => {
  it('hands over a film it is holding', async () => {
    const answer = await aHeldFile(folder, `/held/${ID}`, null);

    expect(answer.status).toBe(200);
    expect(answer.headers.get('content-type')).toBe('video/mp4');
    await expect(answer.text()).resolves.toBe(FILM);
  });

  it('says it takes ranges, so a player will try to scrub', async () => {
    const answer = await aHeldFile(folder, `/held/${ID}`, null);

    expect(answer.headers.get('accept-ranges')).toBe('bytes');
  });

  it('hands over the part that was asked for', async () => {
    const answer = await aHeldFile(folder, `/held/${ID}`, 'bytes=2-4');

    expect(answer.status).toBe(206);
    expect(answer.headers.get('content-range')).toBe('bytes 2-4/10');
    expect(answer.headers.get('content-length')).toBe('3');
    await expect(answer.text()).resolves.toBe('cde');
  });

  it('hands over the artwork beside it', async () => {
    const answer = await aHeldFile(folder, `/held/${ID}/poster`, null);

    expect(answer.headers.get('content-type')).toBe('image/jpeg');
    await expect(answer.text()).resolves.toBe('an-image');
  });

  it('says plainly that it is not holding something rather than failing', async () => {
    const answer = await aHeldFile(folder, '/held/11111111-1111-4111-8111-111111111111', null);

    expect(answer.status).toBe(404);
  });

  it('refuses an address that is not a held file at all', async () => {
    expect((await aHeldFile(folder, '/held/../thePreferenceFile', null)).status).toBe(404);
  });
});
