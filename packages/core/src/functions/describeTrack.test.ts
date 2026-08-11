import { describe, expect, it } from 'vitest';
import {
  describeAudioTrack,
  describeLanguage,
  describeChannels,
  readLanguage,
} from './describeTrack';
import type { AudioTrackFacts } from './describeTrack';

const track = (overrides: Partial<AudioTrackFacts> = {}): AudioTrackFacts => ({
  index: 1,
  codec: 'aac',
  channels: 2,
  ...overrides,
});

describe('readLanguage', () => {
  it('normalises the three letter forms onto the two letter one', () => {
    expect(readLanguage('eng')).toBe('en');
    expect(readLanguage('ger')).toBe('de');
    expect(readLanguage('deu')).toBe('de');
  });

  it('normalises a language written out', () => {
    expect(readLanguage('Japanese')).toBe('ja');
  });

  it('treats every way of saying nothing as nothing', () => {
    for (const nothing of ['', '  ', 'und', 'unknown', 'zxx', 'mul', 'mis']) {
      expect(readLanguage(nothing)).toBeNull();
    }
  });

  it('treats an absent tag as nothing', () => {
    expect(readLanguage(null)).toBeNull();
    expect(readLanguage(undefined)).toBeNull();
  });

  it('carries an unrecognised code through rather than guessing', () => {
    expect(readLanguage('tlh')).toBe('tlh');
  });
});

describe('describeLanguage', () => {
  it('names a language the way its speakers write it', () => {
    expect(describeLanguage('jpn')).toBe('日本語');
    expect(describeLanguage('fre')).toBe('Français');
  });

  it('shows an unrecognised code as written rather than inventing a name', () => {
    expect(describeLanguage('tlh')).toBe('TLH');
  });

  it('reports nothing when the file said nothing', () => {
    expect(describeLanguage('und')).toBeNull();
  });
});

describe('describeChannels', () => {
  it('describes a layout the way it is sold', () => {
    expect(describeChannels(1)).toBe('Mono');
    expect(describeChannels(2)).toBe('Stereo');
    expect(describeChannels(6)).toBe('5.1');
    expect(describeChannels(8)).toBe('7.1');
  });

  it('falls back to a count for a layout with no common name', () => {
    expect(describeChannels(5)).toBe('5ch');
  });
});

describe('describeAudioTrack', () => {
  it('names a track by its language and what it sounds like', () => {
    expect(describeAudioTrack(track({ language: 'eng', channels: 6, codec: 'ac3' }), 1)).toBe(
      'English · 5.1 · AC3',
    );
  });

  it('uses the position rather than calling a track Unknown', () => {
    expect(describeAudioTrack(track({ language: null }), 2)).toBe('Track 2 · Stereo · AAC');
  });

  it('counts tracks the way a viewer does, not the way a container does', () => {
    // Stream 3 of a container is the second audio track, and nobody watching
    // knows what stream 3 is.
    expect(describeAudioTrack(track({ index: 3, language: 'und' }), 2)).toContain('Track 2');
  });

  it('uses what a file calls a track when it says nothing else', () => {
    expect(describeAudioTrack(track({ title: 'Commentary' }), 1)).toBe('Commentary · Stereo · AAC');
  });

  it('shows the language and the title when both say something', () => {
    expect(describeAudioTrack(track({ language: 'eng', title: 'Commentary' }), 1)).toBe(
      'English · Commentary · Stereo · AAC',
    );
  });

  it('does not stutter when the title already names the language', () => {
    expect(describeAudioTrack(track({ language: 'eng', title: 'English Commentary' }), 1)).toBe(
      'English Commentary · Stereo · AAC',
    );
  });

  it('says Atmos rather than the codec underneath it', () => {
    expect(
      describeAudioTrack(
        track({ language: 'eng', channels: 8, codec: 'truehd', isAtmos: true }),
        1,
      ),
    ).toBe('English · 7.1 · Atmos');
  });

  it('ignores a title that is only whitespace', () => {
    expect(describeAudioTrack(track({ language: 'eng', title: '   ' }), 1)).toBe(
      'English · Stereo · AAC',
    );
  });

  it('tells two tracks of one language apart by their titles', () => {
    const first = describeAudioTrack(track({ language: 'eng', title: 'Original' }), 1);
    const second = describeAudioTrack(track({ language: 'eng', title: 'Commentary' }), 2);

    expect(first).not.toBe(second);
  });
});
