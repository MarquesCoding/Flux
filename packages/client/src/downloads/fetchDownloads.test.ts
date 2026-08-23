import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  askForDownload,
  askForSeries,
  setDownloadPaused,
  fetchDownloadOffer,
  fetchDownloads,
  fetchHoldings,
  forgetDownload,
  setHolding,
} from './fetchDownloads';
import type { DeviceProfile } from '@ValenceContracts/schemas/DeviceProfile';

const PROFILE: DeviceProfile = {
  schemaVersion: 1,
  name: 'A browser',
  directPlayProfiles: [],
  transcodingProfiles: [],
  supportedSubtitleFormats: [],
  supportedVideoRanges: ['SDR'],
  maxVideoLevels: {},
  tenBitVideoCodecs: [],
  unsupportedAudioProfiles: [],
  maxAudioChannels: 2,
  maxWidth: 1920,
  maxHeight: 1080,
  canPlayInterlaced: false,
  canPlayAnamorphic: false,
  canRotate: false,
};

const A_DOWNLOAD = {
  id: '00000000-0000-4000-8000-000000000001',
  mediaId: '00000000-0000-4000-8000-000000000002',
  seriesId: null,
  seriesTitle: null,
  title: 'Arrival',
  quality: '1080p',
  audioLanguages: ['eng'],
  state: 'preparing',
  progress: 0.25,
  sizeBytes: null,
  failure: null,
  askedAt: '2026-01-01T00:00:00.000Z',
  readyAt: null,
};

const AskSchema = z.object({ body: z.string().optional(), method: z.string().optional() });

/**
 * What the code sent on the call at this position.
 *
 * @param at - Which call.
 * @returns The request, read through a schema rather than trusted.
 */
const sentOn = (at: number) => AskSchema.parse(fetchMock.mock.calls[at]?.[1] ?? {});

const fetchMock = vi.fn();

/**
 * An answer from the server.
 *
 * @param body - What it said.
 * @param ok - Whether it was willing.
 * @returns The response.
 */
const answering = (body: object, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  json: () => Promise.resolve(body),
});

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchDownloadOffer', () => {
  it('sends the device profile, since part of the answer is about the device', async () => {
    fetchMock.mockResolvedValue(
      answering({ mediaId: A_DOWNLOAD.mediaId, title: 'Arrival', options: [] }),
    );

    await fetchDownloadOffer(A_DOWNLOAD.mediaId, PROFILE);

    expect(JSON.parse(String(sentOn(0).body))).toMatchObject({
      deviceProfile: { name: 'A browser' },
    });
  });

  it('reads back what each rung would cost', async () => {
    fetchMock.mockResolvedValue(
      answering({
        mediaId: A_DOWNLOAD.mediaId,
        title: 'Arrival',
        options: [
          {
            quality: 'original',
            label: 'Original',
            meaning: 'The best it gets.',
            bytes: 60_000_000_000,
            comparison: null,
            wouldTranscode: true,
          },
        ],
      }),
    );

    const offer = await fetchDownloadOffer(A_DOWNLOAD.mediaId, PROFILE);

    expect(offer?.options[0]?.bytes).toBe(60_000_000_000);
    expect(offer?.options[0]?.wouldTranscode).toBe(true);
  });

  it('answers nothing rather than throwing where the server would not say', async () => {
    fetchMock.mockResolvedValue(answering({}, false));

    expect(await fetchDownloadOffer(A_DOWNLOAD.mediaId, PROFILE)).toBeNull();
  });

  it('answers nothing where the server could not be reached at all', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    expect(await fetchDownloadOffer(A_DOWNLOAD.mediaId, PROFILE)).toBeNull();
  });
});

describe('askForDownload', () => {
  it('asks for a rung and reads back where it has got to', async () => {
    fetchMock.mockResolvedValue(answering(A_DOWNLOAD));

    const started = await askForDownload(A_DOWNLOAD.mediaId, '1080p');

    expect(started?.state).toBe('preparing');
    expect(started?.progress).toBe(0.25);
  });

  it('carries the languages somebody chose', async () => {
    fetchMock.mockResolvedValue(answering(A_DOWNLOAD));

    await askForDownload(A_DOWNLOAD.mediaId, '1080p', ['eng', 'jpn']);

    expect(JSON.parse(String(sentOn(0).body))).toMatchObject({ audioLanguages: ['eng', 'jpn'] });
  });

  it('answers nothing where the server refused', async () => {
    fetchMock.mockResolvedValue(answering({}, false));

    expect(await askForDownload(A_DOWNLOAD.mediaId, '1080p')).toBeNull();
  });
});

describe('askForSeries', () => {
  it('asks for the programme and reads back the queue', async () => {
    fetchMock.mockResolvedValue(answering({ downloads: [A_DOWNLOAD, A_DOWNLOAD] }));

    const queued = await askForSeries('a-show', '1080p');

    expect(queued).toHaveLength(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/series/a-show/downloads');
  });

  it('answers with nothing rather than throwing where the server refused', async () => {
    fetchMock.mockResolvedValue(answering({}, false));

    expect(await askForSeries('a-show', '1080p')).toEqual([]);
  });
});

describe('setDownloadPaused', () => {
  it('asks to pause', async () => {
    fetchMock.mockResolvedValue(answering({}, true));

    await setDownloadPaused(A_DOWNLOAD.id, true);

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/pause');
  });

  it('asks to carry on', async () => {
    fetchMock.mockResolvedValue(answering({}, true));

    await setDownloadPaused(A_DOWNLOAD.id, false);

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/resume');
  });

  it('says so rather than throwing where it could not be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    expect(await setDownloadPaused(A_DOWNLOAD.id, true)).toBe(false);
  });
});

describe('fetchDownloads', () => {
  it('reads everything that has been asked for', async () => {
    fetchMock.mockResolvedValue(answering({ downloads: [A_DOWNLOAD] }));

    expect(await fetchDownloads()).toHaveLength(1);
  });
});

describe('forgetDownload', () => {
  it('says whether the server let it go', async () => {
    fetchMock.mockResolvedValue(answering({}, true));

    expect(await forgetDownload(A_DOWNLOAD.id)).toBe(true);
  });

  it('says so rather than throwing where it could not be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    expect(await forgetDownload(A_DOWNLOAD.id)).toBe(false);
  });
});

describe('holdings', () => {
  it('reads what devices say they are holding', async () => {
    fetchMock.mockResolvedValue(
      answering({
        holdings: [
          { mediaId: A_DOWNLOAD.mediaId, quality: '1080p', heldAt: '2026-01-01T00:00:00.000Z' },
        ],
      }),
    );

    expect(await fetchHoldings()).toHaveLength(1);
  });

  it('records a copy arriving with a put', async () => {
    fetchMock.mockResolvedValue(answering({}, true));

    await setHolding(A_DOWNLOAD.mediaId, '1080p', true);

    expect(sentOn(0).method).toBe('PUT');
  });

  it('records one going away with a delete, naming which rendition went', async () => {
    fetchMock.mockResolvedValue(answering({}, true));

    await setHolding(A_DOWNLOAD.mediaId, '1080p', false);

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/holdings/1080p');
    expect(sentOn(0).method).toBe('DELETE');
  });
});
