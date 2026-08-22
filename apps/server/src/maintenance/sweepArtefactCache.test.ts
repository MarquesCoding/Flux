import { describe, expect, it, vi } from 'vitest';
import { sweepArtefactCache } from './sweepArtefactCache';
import type { LiveItem } from './sweepArtefactCache';
import type { AudioStream } from '@ValenceContracts/schemas/MediaItem';
import type { PreviewSweepSubject, SweepReport } from '@ValenceServer/transcoder/TranscoderClient';

const GEOMETRY = { intervalSeconds: 10, tileWidth: 320, columns: 10, rows: 10 };

const stream = (index: number, language: string | null): AudioStream => ({
  index,
  codec: 'aac',
  channels: 2,
  language,
  title: null,
  isDefault: index === 0,
  isAtmos: false,
});

const item = (overrides: Partial<LiveItem> = {}): LiveItem => ({
  path: '/media/arrival.mkv',
  audioStreams: [stream(0, 'eng'), stream(1, 'deu')],
  generation: 0,
  defaultAudioLanguage: null,
  ...overrides,
});

const report = (removed: number, freedBytes: number): SweepReport => ({
  removed,
  freedBytes,
  kept: 0,
  tooNew: 0,
});

const harness = (items: LiveItem[]) => {
  const previewKeep: PreviewSweepSubject[][] = [];
  const trickplayKeep: { inputPath: string; generation: number }[][] = [];

  return {
    previewKeep,
    trickplayKeep,
    transcoder: {
      sweepPreviews: (keep: PreviewSweepSubject[]) => {
        previewKeep.push(keep);

        return Promise.resolve(report(1, 100));
      },
      sweepTrickplay: (keep: { inputPath: string; generation: number }[]) => {
        trickplayKeep.push(keep);

        return Promise.resolve(report(2, 200));
      },
    },
    listLiveItems: () => Promise.resolve(items),
  };
};

describe('sweeping artefacts nothing addresses', () => {
  it('adds up what both kinds reclaimed', async () => {
    const { transcoder, listLiveItems } = harness([item()]);

    const total = await sweepArtefactCache({ listLiveItems, trickplay: GEOMETRY, transcoder });

    expect(total).toMatchObject({ removed: 3, freedBytes: 300 });
  });

  it('keeps a clip by the same request the generator would have made', async () => {
    const { transcoder, listLiveItems, previewKeep } = harness([
      item({ generation: 2, defaultAudioLanguage: 'deu' }),
    ]);

    await sweepArtefactCache({ listLiveItems, trickplay: GEOMETRY, transcoder });

    expect(previewKeep[0]).toEqual([
      { inputPath: '/media/arrival.mkv', generation: 2, audioStreamIndex: 1 },
    ]);
  });

  it('leaves the stream unnamed when no language is forced, exactly as the generator does', async () => {
    const { transcoder, listLiveItems, previewKeep } = harness([item()]);

    await sweepArtefactCache({ listLiveItems, trickplay: GEOMETRY, transcoder });

    expect(previewKeep[0]?.[0]).not.toHaveProperty('audioStreamIndex');
  });

  it('keeps sheets by their geometry as well as their generation', async () => {
    const { transcoder, listLiveItems, trickplayKeep } = harness([item({ generation: 5 })]);

    await sweepArtefactCache({ listLiveItems, trickplay: GEOMETRY, transcoder });

    expect(trickplayKeep[0]).toEqual([
      { inputPath: '/media/arrival.mkv', generation: 5, ...GEOMETRY },
    ]);
  });

  it('keeps every library at once, since they share one cache', async () => {
    const { transcoder, listLiveItems, previewKeep } = harness([
      item({ path: '/films/a.mkv', generation: 1 }),
      item({ path: '/shows/b.mkv', generation: 7 }),
    ]);

    await sweepArtefactCache({ listLiveItems, trickplay: GEOMETRY, transcoder });

    expect(previewKeep[0]).toHaveLength(2);
    expect(previewKeep[0]?.map((one) => one.generation)).toEqual([1, 7]);
  });

  it('sweeps sheets even when clips could not be swept', async () => {
    const onProblem = vi.fn();

    const total = await sweepArtefactCache({
      listLiveItems: () => Promise.resolve([item()]),
      trickplay: GEOMETRY,
      transcoder: {
        sweepPreviews: () => Promise.reject(new Error('the media service is down')),
        sweepTrickplay: () => Promise.resolve(report(2, 200)),
      },
      onProblem,
    });

    expect(total).toMatchObject({ removed: 2, freedBytes: 200 });
    expect(onProblem).toHaveBeenCalledWith('previews', 'the media service is down');
  });

  it('reclaims nothing rather than failing when the media service is unreachable', async () => {
    const total = await sweepArtefactCache({
      listLiveItems: () => Promise.resolve([item()]),
      trickplay: GEOMETRY,
      transcoder: {
        sweepPreviews: () => Promise.reject(new Error('down')),
        sweepTrickplay: () => Promise.reject(new Error('down')),
      },
    });

    expect(total).toEqual({ removed: 0, freedBytes: 0, kept: 0, tooNew: 0 });
  });

  it('asks for nothing to be kept when every library is empty', async () => {
    const { transcoder, listLiveItems, previewKeep, trickplayKeep } = harness([]);

    await sweepArtefactCache({ listLiveItems, trickplay: GEOMETRY, transcoder });

    expect(previewKeep[0]).toEqual([]);
    expect(trickplayKeep[0]).toEqual([]);
  });
});
