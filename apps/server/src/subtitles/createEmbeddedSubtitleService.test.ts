import { describe, expect, it, vi } from 'vitest';
import {
  createEmbeddedSubtitleService,
  describeSubtitle,
  marksHearingImpaired,
} from './createEmbeddedSubtitleService';
import type { EmbeddedStream } from './createEmbeddedSubtitleService';

const MEDIA_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';
const PATH = '/media/Parasite (2019).mkv';

const streamOf = (changes: Partial<EmbeddedStream> = {}): EmbeddedStream => ({
  index: 2,
  format: 'subrip',
  language: 'eng',
  title: null,
  isForced: false,
  ...changes,
});

const build = (streams: EmbeddedStream[], readSubtitle = vi.fn().mockResolvedValue('WEBVTT')) => {
  const onProblem = vi.fn();

  const service = createEmbeddedSubtitleService({
    media: {
      find: (mediaId) => Promise.resolve(mediaId === MEDIA_ID ? { path: PATH, streams } : null),
    },
    transcoder: { readSubtitle },
    onProblem,
  });

  return { service, readSubtitle, onProblem };
};

describe('describeSubtitle', () => {
  it('uses the name the container gave, which is better than any convention', () => {
    expect(describeSubtitle(streamOf({ title: 'English-SDH', language: null }), 1)).toBe(
      'English-SDH',
    );
  });

  it('names a track by its language when the container did not name it', () => {
    expect(describeSubtitle(streamOf({ title: null }), 1)).toBe('English');
  });

  it('says both when the title adds something the language does not', () => {
    expect(describeSubtitle(streamOf({ title: 'Signs' }), 1)).toBe('English · Signs');
  });

  it('does not say the language twice', () => {
    expect(describeSubtitle(streamOf({ title: 'English (SDH)' }), 1)).toBe('English (SDH)');
  });

  it('falls back to a number when the container said nothing at all', () => {
    expect(describeSubtitle(streamOf({ title: null, language: null }), 3)).toBe('Track 3');
  });

  it('says a forced track is forced', () => {
    expect(describeSubtitle(streamOf({ isForced: true }), 1)).toBe('English · Forced');
  });

  it('does not say forced twice when the container already said it', () => {
    expect(describeSubtitle(streamOf({ isForced: true, title: 'Forced' }), 1)).toBe(
      'English · Forced',
    );
  });
});

describe('marksHearingImpaired', () => {
  it('reads the marks a title puts on a track carrying more than dialogue', () => {
    expect(marksHearingImpaired('English SDH')).toBe(true);
    expect(marksHearingImpaired('English CC')).toBe(true);
    expect(marksHearingImpaired('Hard of hearing')).toBe(true);
  });

  it('does not read a mark into an ordinary track', () => {
    expect(marksHearingImpaired('English')).toBe(false);
  });

  it('is untroubled by a track with no name', () => {
    expect(marksHearingImpaired(null)).toBe(false);
  });
});

describe('createEmbeddedSubtitleService', () => {
  it('offers what is inside the container, which is why VLC finds tracks Flux once did not', async () => {
    const { service } = build([streamOf()]);

    await expect(service.list(MEDIA_ID)).resolves.toHaveLength(1);
  });

  it('says it has never heard of an item it cannot find', async () => {
    const { service } = build([streamOf()]);

    await expect(service.list('00000000-0000-4000-8000-000000000000')).resolves.toBeNull();
  });

  it('leaves out tracks that are pictures of words rather than words', async () => {
    const { service } = build([streamOf({ format: 'pgs' }), streamOf({ index: 3 })]);

    await expect(service.list(MEDIA_ID)).resolves.toHaveLength(1);
  });

  it('leaves out a track whose codec nothing recognised', async () => {
    const { service } = build([streamOf({ format: 'unknown' }), streamOf({ index: 3 })]);

    await expect(service.list(MEDIA_ID)).resolves.toHaveLength(1);
  });

  it('names a track from the file and the stream, so it survives a restart', async () => {
    const { service } = build([streamOf()]);

    const first = await service.list(MEDIA_ID);
    const again = await service.list(MEDIA_ID);

    expect(first?.[0]?.id).toBe(again?.[0]?.id);
  });

  it('does not name two streams the same thing', async () => {
    const { service } = build([streamOf({ index: 2 }), streamOf({ index: 3 })]);

    const tracks = await service.list(MEDIA_ID);

    expect(new Set(tracks?.map((track) => track.id)).size).toBe(2);
  });

  it('pulls a track out of the container when it is asked for', async () => {
    const { service, readSubtitle } = build([streamOf()]);
    const tracks = await service.list(MEDIA_ID);

    await expect(service.read(MEDIA_ID, tracks?.[0]?.id ?? '')).resolves.toBe('WEBVTT');
    expect(readSubtitle).toHaveBeenCalledWith({ inputPath: PATH, streamIndex: 2 });
  });

  it('answers with nothing for a track the file does not have', async () => {
    const { service } = build([streamOf()]);

    await expect(service.read(MEDIA_ID, 'made-up')).resolves.toBeNull();
  });

  it('answers with nothing rather than failing when extraction goes wrong', async () => {
    const { service } = build([streamOf()], vi.fn().mockRejectedValue(new Error('no such stream')));
    const tracks = await service.list(MEDIA_ID);

    await expect(service.read(MEDIA_ID, tracks?.[0]?.id ?? '')).resolves.toBeNull();
  });

  it('says why it could not read a track, rather than failing quietly', async () => {
    const { service, onProblem } = build(
      [streamOf()],
      vi.fn().mockRejectedValue(new Error('no such stream')),
    );
    const tracks = await service.list(MEDIA_ID);

    await service.read(MEDIA_ID, tracks?.[0]?.id ?? '');

    expect(onProblem).toHaveBeenCalledWith(PATH, 'no such stream');
  });
});
