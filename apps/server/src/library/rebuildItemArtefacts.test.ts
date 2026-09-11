import { describe, expect, it, vi } from 'vitest';
import { rebuildItemArtefacts } from './rebuildItemArtefacts';
import type { RebuildSubject } from './rebuildItemArtefacts';
import type { AudioStream } from '@ValenceContracts/schemas/MediaItem';
import type {
  PreviewSweepSubject,
  TrickplayRequest,
} from '@ValenceServer/transcoder/TranscoderClient';

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

const item = (overrides: Partial<RebuildSubject> = {}): RebuildSubject => ({
  path: '/media/arrival.mkv',
  audioStreams: [stream(0, 'eng'), stream(1, 'deu')],
  generation: 0,
  defaultAudioLanguage: null,
  ...overrides,
});

const harness = () => {
  const asked: { preview: PreviewSweepSubject[]; trickplay: TrickplayRequest[] } = {
    preview: [],
    trickplay: [],
  };

  return {
    asked,
    transcoder: {
      forgetPreview: (request: PreviewSweepSubject) => {
        asked.preview.push(request);

        return Promise.resolve(true);
      },
      forgetTrickplay: (request: TrickplayRequest) => {
        asked.trickplay.push(request);

        return Promise.resolve(true);
      },
    },
  };
};

describe('rebuilding one item', () => {
  it('throws away both of its artefacts', async () => {
    const { transcoder } = harness();

    const outcome = await rebuildItemArtefacts({
      item: item(),
      trickplay: GEOMETRY,
      quality: 'high',
      transcoder,
    });

    expect(outcome).toEqual({ preview: true, trickplay: true });
  });

  it('addresses the clip the way the generator would have made it', async () => {
    const { transcoder, asked } = harness();

    await rebuildItemArtefacts({
      item: item({ generation: 3, defaultAudioLanguage: 'deu' }),
      trickplay: GEOMETRY,
      quality: 'high',
      transcoder,
    });

    expect(asked.preview[0]).toEqual({
      inputPath: '/media/arrival.mkv',
      generation: 3,
      quality: 'high',
      audioStreamIndex: 1,
    });
  });

  it('leaves the stream unnamed when no language is forced, as the generator does', async () => {
    const { transcoder, asked } = harness();

    await rebuildItemArtefacts({ item: item(), trickplay: GEOMETRY, quality: 'high', transcoder });

    expect(asked.preview[0]).not.toHaveProperty('audioStreamIndex');
  });

  it('addresses the sheets by their geometry and generation', async () => {
    const { transcoder, asked } = harness();

    await rebuildItemArtefacts({
      item: item({ generation: 5 }),
      trickplay: GEOMETRY,
      quality: 'high',
      transcoder,
    });

    expect(asked.trickplay[0]).toEqual({
      inputPath: '/media/arrival.mkv',
      generation: 5,
      ...GEOMETRY,
    });
  });

  it('says so when there was nothing there to remove', async () => {
    const outcome = await rebuildItemArtefacts({
      item: item(),
      trickplay: GEOMETRY,
      quality: 'high',
      transcoder: {
        forgetPreview: () => Promise.resolve(false),
        forgetTrickplay: () => Promise.resolve(false),
      },
    });

    expect(outcome).toEqual({ preview: false, trickplay: false });
  });

  it('still throws away the sheets when the clip could not be reached', async () => {
    const onProblem = vi.fn();

    const outcome = await rebuildItemArtefacts({
      item: item(),
      trickplay: GEOMETRY,
      quality: 'high',
      transcoder: {
        forgetPreview: () => Promise.reject(new Error('the media service is down')),
        forgetTrickplay: () => Promise.resolve(true),
      },
      onProblem,
    });

    expect(outcome).toEqual({ preview: false, trickplay: true });
    expect(onProblem).toHaveBeenCalledWith('preview', 'the media service is down');
  });

  it('reports failure rather than throwing when nothing can be reached', async () => {
    const outcome = await rebuildItemArtefacts({
      item: item(),
      trickplay: GEOMETRY,
      quality: 'high',
      transcoder: {
        forgetPreview: () => Promise.reject(new Error('down')),
        forgetTrickplay: () => Promise.reject(new Error('down')),
      },
    });

    expect(outcome).toEqual({ preview: false, trickplay: false });
  });

  it('addresses the clip at the preset it was made at', async () => {
    const { transcoder, asked } = harness();

    await rebuildItemArtefacts({
      item: item(),
      trickplay: GEOMETRY,
      quality: 'standard',
      transcoder,
    });

    expect(asked.preview[0]).toMatchObject({ quality: 'standard' });
  });
});
