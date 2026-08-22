import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useNowPlaying } from './useNowPlaying';
import type { NowPlaying } from './useNowPlaying';

type Handler = ((details: { seekTime?: number; seekOffset?: number }) => void) | null;

const handlers = new Map<string, Handler>();

class FakeMetadata {
  title: string;
  artist: string;
  album: string;
  artwork: { src: string; sizes: string }[];

  constructor(init: {
    title: string;
    artist: string;
    album: string;
    artwork: { src: string; sizes: string }[];
  }) {
    this.title = init.title;
    this.artist = init.artist;
    this.album = init.album;
    this.artwork = init.artwork;
  }
}

type Session = {
  metadata: FakeMetadata | null;
  playbackState: string;
  setPositionState: ReturnType<typeof vi.fn>;
  setActionHandler: ReturnType<typeof vi.fn>;
};

const session: Session = {
  metadata: null,
  playbackState: 'none',
  setPositionState: vi.fn(),
  setActionHandler: vi.fn((action: string, handler: Handler) => {
    handlers.set(action, handler);
  }),
};

const AN_EPISODE = {
  id: 'a-media-id',
  title: 'The One With The Thing',
  seriesTitle: 'A Programme',
  seasonNumber: 2,
  episodeNumber: 12,
  hasPoster: true,
};

const playing = (overrides: Partial<NowPlaying> = {}) => {
  const onTogglePlay = vi.fn();
  const onSeek = vi.fn();

  const Showing = () => {
    useNowPlaying({
      media: AN_EPISODE,
      isPlaying: true,
      positionSeconds: 30,
      durationSeconds: 1200,
      onTogglePlay,
      onSeek,
      ...overrides,
    });

    return null;
  };

  return { onTogglePlay, onSeek, ...render(<Showing />) };
};

beforeEach(() => {
  handlers.clear();
  session.metadata = null;
  session.playbackState = 'none';
  session.setPositionState.mockClear();
  session.setActionHandler.mockClear();
  vi.stubGlobal('MediaMetadata', FakeMetadata);
  Object.defineProperty(navigator, 'mediaSession', { value: session, configurable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useNowPlaying', () => {
  it('says what is playing, so the system shows a title rather than the application name', () => {
    playing();

    expect(session.metadata).toMatchObject({ title: 'The One With The Thing' });
  });

  it('names the programme an episode belongs to', () => {
    playing();

    expect(session.metadata).toMatchObject({ artist: 'A Programme' });
  });

  it('says which episode, the way somebody would say it', () => {
    playing();

    expect(session.metadata).toMatchObject({ album: 'Series 2, Episode 12' });
  });

  it('says Valence for a film, which belongs to no programme', () => {
    playing({ media: { id: 'a-film', title: 'A Film', hasPoster: true } });

    expect(session.metadata).toMatchObject({ artist: 'Valence', album: '' });
  });

  it('offers the poster to draw, since the alternative is a blank square', () => {
    playing();

    expect(session.metadata?.artwork[0]?.src).toBe('/api/media/a-media-id/image/poster');
    expect(session.metadata?.artwork.length).toBeGreaterThan(0);
  });

  it('offers no artwork for something that has none, rather than a broken picture', () => {
    playing({ media: { id: 'a-film', title: 'A Film', hasPoster: false } });

    expect(session.metadata?.artwork).toEqual([]);
  });

  it('says whether it is playing, which is what the button in the panel draws', () => {
    playing();

    expect(session.playbackState).toBe('playing');
  });

  it('says when it is not', () => {
    playing({ isPlaying: false });

    expect(session.playbackState).toBe('paused');
  });

  it('says where it is up to, so the panel can draw a position', () => {
    playing();

    expect(session.setPositionState).toHaveBeenCalledWith({
      duration: 1200,
      position: 30,
      playbackRate: 1,
    });
  });

  it('says nothing about a position it does not know', () => {
    playing({ durationSeconds: 0 });

    expect(session.setPositionState).not.toHaveBeenCalled();
  });

  it('pauses through the player, not the element, so a watch party stays together', () => {
    const { onTogglePlay } = playing();

    handlers.get('pause')?.({});

    expect(onTogglePlay).toHaveBeenCalledOnce();
  });

  it('plays through the player for the same reason', () => {
    const { onTogglePlay } = playing();

    handlers.get('play')?.({});

    expect(onTogglePlay).toHaveBeenCalledOnce();
  });

  it('skips forward by what the system asked for', () => {
    const { onSeek } = playing();

    handlers.get('seekforward')?.({ seekOffset: 30 });

    expect(onSeek).toHaveBeenCalledWith(60);
  });

  it('skips back by ten where the system did not say', () => {
    const { onSeek } = playing();

    handlers.get('seekbackward')?.({});

    expect(onSeek).toHaveBeenCalledWith(20);
  });

  it('never seeks before the beginning, however far back it is asked', () => {
    const { onSeek } = playing({ positionSeconds: 5 });

    handlers.get('seekbackward')?.({ seekOffset: 60 });

    expect(onSeek).toHaveBeenCalledWith(0);
  });

  it('never seeks past the end', () => {
    const { onSeek } = playing({ positionSeconds: 1190 });

    handlers.get('seekforward')?.({ seekOffset: 60 });

    expect(onSeek).toHaveBeenCalledWith(1200);
  });

  it('goes where a scrubbed panel asked', () => {
    const { onSeek } = playing();

    handlers.get('seekto')?.({ seekTime: 600 });

    expect(onSeek).toHaveBeenCalledWith(600);
  });

  it('lets go of what is playing when the player goes, rather than leaving a ghost', () => {
    const { unmount } = playing();

    unmount();

    expect(session.metadata).toBeNull();
  });

  it('draws nothing on an engine that has no such controls', () => {
    Object.defineProperty(navigator, 'mediaSession', { value: undefined, configurable: true });

    expect(() => playing()).not.toThrow();
  });
});
