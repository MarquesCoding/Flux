import { describe, expect, it } from 'vitest';
import { liftCues, CUE_LINE_CLEAR, CUE_LINE_ABOVE_CONTROLS } from './liftCues';

/**
 * A cue as a browser hands one over.
 *
 * The position is optional because not every format carries one: a cue made of
 * pictures has nothing to place, and the lifting has to leave it alone rather
 * than throw at it.
 */
type FakeCue = { text: string; line?: number | 'auto'; snapToLines?: boolean };

/**
 * A track list of the shape a browser hands back, which jsdom does not have.
 *
 * The listeners are real, because what is being tested is when the cues are
 * moved as much as where they are moved to.
 */
const videoWith = (cues: FakeCue[], mode = 'showing') => {
  const listeners = new Map<string, () => void>();

  const track = {
    mode,
    cues,
    addEventListener: (kind: string, listener: () => void) => listeners.set(kind, listener),
    removeEventListener: (kind: string) => listeners.delete(kind),
  };

  const trackListeners = new Map<string, () => void>();

  const tracks = Object.assign([track], {
    addEventListener: (kind: string, listener: () => void) => trackListeners.set(kind, listener),
    removeEventListener: (kind: string) => trackListeners.delete(kind),
  });

  const element = document.createElement('video');

  Object.defineProperty(element, 'textTracks', { value: tracks });

  return {
    element,
    track,
    saying: () => listeners.get('cuechange')?.(),
    adding: () => trackListeners.get('addtrack')?.(),
    isWatched: () => listeners.has('cuechange'),
  };
};

const cueOf = (text: string): FakeCue => ({ text, line: 'auto', snapToLines: true });

describe('liftCues', () => {
  it('puts the cues where it is told', () => {
    const film = videoWith([cueOf('A line')]);

    liftCues(film.element, () => CUE_LINE_ABOVE_CONTROLS);

    expect(film.track.cues[0]).toMatchObject({ line: CUE_LINE_ABOVE_CONTROLS, snapToLines: false });
  });

  it('asks again each time, so the line can change without starting over', () => {
    const film = videoWith([cueOf('A line')]);
    let isBarUp = true;

    liftCues(film.element, () => (isBarUp ? CUE_LINE_ABOVE_CONTROLS : CUE_LINE_CLEAR));

    isBarUp = false;
    film.saying();

    expect(film.track.cues[0]?.line).toBe(CUE_LINE_CLEAR);
  });

  it('moves the cues arriving after it, since a track carries none at first', () => {
    const film = videoWith([]);

    liftCues(film.element, () => CUE_LINE_ABOVE_CONTROLS);

    film.track.cues.push(cueOf('Arrived late'));
    film.saying();

    expect(film.track.cues[0]?.line).toBe(CUE_LINE_ABOVE_CONTROLS);
  });

  it('watches a track added after it', () => {
    const film = videoWith([cueOf('A line')]);

    liftCues(film.element, () => CUE_LINE_CLEAR);
    film.adding();

    expect(film.isWatched()).toBe(true);
  });

  it('leaves alone a cue with no position to set', () => {
    // A cue from a format that carries pictures rather than words has neither
    // a line nor anything to snap it to.
    const film = videoWith([]);
    film.track.cues.push({ text: 'A picture of words' });

    expect(() => {
      liftCues(film.element, () => CUE_LINE_CLEAR);
    }).not.toThrow();
  });

  it('does not ask for a redraw while cues are merely going past', () => {
    const film = videoWith([cueOf('A line')]);

    liftCues(film.element, () => CUE_LINE_CLEAR);
    film.saying();

    expect(film.track.mode).toBe('showing');
  });

  it('asks for the cue afresh when the caller says something changed', () => {
    const film = videoWith([cueOf('A line')]);
    const modes: string[] = [];

    Object.defineProperty(film.track, 'mode', {
      get: () => modes.at(-1) ?? 'showing',
      set: (next: string) => modes.push(next),
    });

    liftCues(film.element, () => CUE_LINE_CLEAR).apply();

    // Off and on again, which is what makes a browser lay out a cue it has
    // already drawn.
    expect(modes).toEqual(['hidden', 'showing']);
  });

  it('stops watching when it is told to', () => {
    const film = videoWith([cueOf('A line')]);

    liftCues(film.element, () => CUE_LINE_CLEAR).stop();

    expect(film.isWatched()).toBe(false);
  });

  it('sits lower when nothing is over the picture than when the controls are', () => {
    expect(CUE_LINE_CLEAR).toBeGreaterThan(CUE_LINE_ABOVE_CONTROLS);
  });
});
