import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchSubtitleTracks,
  subtitleTrackUrl,
  defaultTrackId,
  trackForLanguage,
  previewTrack,
  SUBTITLES_OFF,
} from './fetchSubtitles';
import type { SubtitleTrack } from './fetchSubtitles';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';

const track = (overrides: Partial<SubtitleTrack> = {}): SubtitleTrack => ({
  id: 'en',
  language: 'en',
  label: 'English',
  format: 'srt',
  isForced: false,
  isHearingImpaired: false,
  ...overrides,
});

const respondWith = (answer: { ok: boolean; body: JsonValue }) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: answer.ok,
        status: answer.ok ? 200 : 404,
        json: () => Promise.resolve(answer.body),
      }),
    ),
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('subtitleTrackUrl', () => {
  it('shifts cues to where the stream starts, since a transcode counts from zero', () => {
    expect(subtitleTrackUrl('media-1', 'abc', 2400)).toContain('from=2400');
  });

  it('addresses a track under the item it belongs to', () => {
    expect(subtitleTrackUrl('media-1', 'abc')).toBe('/api/media/media-1/subtitles/abc?from=0');
  });
});

describe('defaultTrackId', () => {
  it('shows a forced track in the language being heard, without being asked', () => {
    expect(defaultTrackId([track(), track({ id: 'en-forced', isForced: true })], 'en')).toBe(
      'en-forced',
    );
  });

  it('leaves a forced track belonging to another dub alone', () => {
    const tracks = [track({ id: 'ita-forced', language: 'ita', isForced: true }), track()];

    expect(defaultTrackId(tracks, 'eng')).toBe(SUBTITLES_OFF);
  });

  it('matches a two letter preference against a three letter track', () => {
    const tracks = [track({ id: 'eng-forced', language: 'eng', isForced: true })];

    expect(defaultTrackId(tracks, 'en')).toBe('eng-forced');
  });

  it('ignores the region on a language that carries one', () => {
    const tracks = [track({ id: 'en-forced', language: 'en', isForced: true })];

    expect(defaultTrackId(tracks, 'en-GB')).toBe('en-forced');
  });

  it('stays off when nothing is forced', () => {
    expect(defaultTrackId([track()], 'en')).toBe(SUBTITLES_OFF);
  });

  it('stays off when there are no tracks at all', () => {
    expect(defaultTrackId([], 'en')).toBe(SUBTITLES_OFF);
  });

  it('stays off rather than guessing when nothing is known about the audio', () => {
    expect(defaultTrackId([track({ id: 'fr', language: 'fr', isForced: true })])).toBe(
      SUBTITLES_OFF,
    );
  });
});

describe('fetchSubtitleTracks', () => {
  it('reads the tracks the server lists', async () => {
    respondWith({ ok: true, body: { tracks: [track()] } });

    await expect(fetchSubtitleTracks('media-1')).resolves.toMatchObject([{ label: 'English' }]);
  });

  it('says so when the server refuses, rather than answering with nothing', async () => {
    respondWith({ ok: false, body: null });

    await expect(fetchSubtitleTracks('media-1')).rejects.toThrow();
  });

  it('says so when the answer is not the shape it was promised', async () => {
    respondWith({ ok: true, body: { tracks: [{ id: 42 }] } });

    await expect(fetchSubtitleTracks('media-1')).rejects.toThrow();
  });
});

describe('trackForLanguage', () => {
  it('continues the language a viewer was already reading', () => {
    const english = track({ id: 'a', language: 'en' });

    expect(trackForLanguage([track({ id: 'b', language: 'fr' }), english], 'en')?.id).toBe('a');
  });

  it('matches a language whatever a file calls the region', () => {
    expect(trackForLanguage([track({ id: 'a', language: 'en-GB' })], 'en')?.id).toBe('a');
  });

  it('answers with nothing where nobody has chosen a language yet', () => {
    expect(trackForLanguage([track({ id: 'a', language: 'en' })], null)).toBeNull();
  });

  it('answers with nothing rather than something else, since a track in a language somebody cannot read is worse than none', () => {
    expect(trackForLanguage([track({ id: 'a', language: 'hu' })], 'en')).toBeNull();
  });

  it('answers with nothing for a file that carries no subtitles', () => {
    expect(trackForLanguage([], 'en')).toBeNull();
  });
});

describe('previewTrack', () => {
  it('prefers a track in the language being spoken', () => {
    const french = track({ id: 'fr', language: 'fr', label: 'French' });

    expect(previewTrack([french, track()], 'en')?.id).toBe('en');
  });

  it('matches on the language rather than on the region it was written for', () => {
    const brazilian = track({ id: 'pt-BR', language: 'pt-BR', label: 'Portuguese' });

    expect(previewTrack([track(), brazilian], 'pt-PT')?.id).toBe('pt-BR');
  });

  it('falls back to the first track rather than showing none', () => {
    const french = track({ id: 'fr', language: 'fr', label: 'French' });

    expect(previewTrack([french], 'de')?.id).toBe('fr');
  });

  it('burns nothing in where there are no tracks at all', () => {
    expect(previewTrack([], 'en')).toBeNull();
  });

  it('copes with a track that says no language', () => {
    expect(previewTrack([track({ id: 'unknown', language: null })], 'en')?.id).toBe('unknown');
  });
});
