import { afterEach, describe, expect, it } from 'vitest';
import { aFakeHeldFiles } from '@ValenceClient/testing/aFakeHeldFiles';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';
import { forgetPlatform, installPlatform } from '@ValenceClient/platform/installPlatform';
import type { Download } from '@ValenceContracts/schemas/Download';
import {
  asSomethingToKeep,
  dropAFile,
  keepAFile,
  pauseAFile,
  posterForAFile,
  sourceForAFile,
} from './keepingFiles';

const prepared: Download = {
  id: '2b2b7f7e-2f0e-4a5e-9c2f-2b9b1e1f0a11',
  mediaId: '9c858901-8a57-4791-81fe-4c455b099bc9',
  seriesId: null,
  seriesTitle: null,
  title: 'The Third Man',
  quality: 'original',
  audioLanguages: [],
  state: 'ready',
  progress: 1,
  bytesPerSecond: null,
  sizeBytes: 4_200_000_000,
  failure: null,
  askedAt: '2026-08-22T00:00:00.000Z',
  readyAt: '2026-08-22T00:10:00.000Z',
};

afterEach(() => {
  forgetPlatform();
});

describe('asSomethingToKeep', () => {
  it('carries what a device needs to draw it with no server to ask', () => {
    expect(asSomethingToKeep(prepared, 5940)).toEqual({
      downloadId: prepared.id,
      mediaId: prepared.mediaId,
      seriesId: null,
      seriesTitle: null,
      title: 'The Third Man',
      quality: 'original',
      durationSeconds: 5940,
      ofBytes: 4_200_000_000,
    });
  });

  it('keeps the programme an episode belongs to, so a shelf can group them', () => {
    const episode = { ...prepared, seriesId: 'a-series', seriesTitle: 'The Bureau' };

    expect(asSomethingToKeep(episode)).toMatchObject({
      seriesId: 'a-series',
      seriesTitle: 'The Bureau',
    });
  });

  it('allows a length nobody told it', () => {
    expect(asSomethingToKeep(prepared).durationSeconds).toBeNull();
  });
});

describe('keepAFile', () => {
  it('asks the device to hold it', async () => {
    const files = aFakeHeldFiles();

    installPlatform(aFakePlatform({ held: files.held }));

    await keepAFile(prepared, 5940);

    expect(files.asked[0]?.downloadId).toBe(prepared.id);
  });
});

describe('dropAFile', () => {
  it('lets go of the copy on this device', async () => {
    const files = aFakeHeldFiles();

    installPlatform(aFakePlatform({ held: files.held }));

    await dropAFile(prepared.id);

    expect(files.dropped).toEqual([prepared.id]);
  });
});

describe('pauseAFile', () => {
  it('stops a transfer and picks it back up', async () => {
    const files = aFakeHeldFiles();

    installPlatform(aFakePlatform({ held: files.held }));

    await pauseAFile(prepared.id, true);
    await pauseAFile(prepared.id, false);

    expect(files.paused).toEqual([
      [prepared.id, true],
      [prepared.id, false],
    ]);
  });
});

describe('sourceForAFile', () => {
  it('gives the player somewhere on this client to look', () => {
    installPlatform(aFakePlatform({ held: aFakeHeldFiles().held }));

    expect(sourceForAFile(prepared.id)).toBe(`/held/${prepared.id}`);
  });

  it('gives the artwork beside it', () => {
    installPlatform(aFakePlatform({ held: aFakeHeldFiles().held }));

    expect(posterForAFile(prepared.id)).toBe(`/held/${prepared.id}/poster`);
  });

  it('offers nowhere on a client that keeps nothing', () => {
    installPlatform(aFakePlatform());

    expect(sourceForAFile(prepared.id)).toBe('');
  });
});
