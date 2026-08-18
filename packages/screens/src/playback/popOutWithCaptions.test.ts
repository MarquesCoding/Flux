import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { popOutWithCaptions, currentLines } from './popOutWithCaptions';

/**
 * A video with the cues a browser would say are showing.
 */
const videoShowing = (tracks: { mode: string; cues: string[] }[]): HTMLVideoElement => {
  const video = document.createElement('video');

  Object.defineProperty(video, 'textTracks', {
    value: tracks.map((track) => ({
      mode: track.mode,
      activeCues: track.cues.map((text) => ({ text })),
    })),
  });

  return video;
};

describe('currentLines', () => {
  it('reads the cue a browser says is showing', () => {
    expect(currentLines(videoShowing([{ mode: 'showing', cues: ['A line'] }]))).toEqual(['A line']);
  });

  it('ignores a track that is switched off', () => {
    expect(currentLines(videoShowing([{ mode: 'disabled', cues: ['A line'] }]))).toEqual([]);
  });

  it('splits a cue that is written over two lines', () => {
    expect(currentLines(videoShowing([{ mode: 'showing', cues: ['First\nSecond'] }]))).toEqual([
      'First',
      'Second',
    ]);
  });

  it('drops the markup, which cannot survive being drawn as plain text', () => {
    expect(currentLines(videoShowing([{ mode: 'showing', cues: ['<v Sam>Hello</v>'] }]))).toEqual([
      'Hello',
    ]);
  });

  it('drops a line that is nothing but space', () => {
    expect(currentLines(videoShowing([{ mode: 'showing', cues: ['  \n'] }]))).toEqual([]);
  });

  it('has nothing to draw for a film with no subtitles', () => {
    expect(currentLines(videoShowing([]))).toEqual([]);
  });
});

describe('popOutWithCaptions', () => {
  const context = {
    drawImage: vi.fn(),
    strokeText: vi.fn(),
    fillText: vi.fn(),
    font: '',
    textAlign: '',
    textBaseline: '',
    lineJoin: '',
    lineWidth: 0,
    strokeStyle: '',
    fillStyle: '',
  };

  const requestPictureInPicture = vi.fn();

  /**
   * A video element the browser is willing to float.
   */
  const playable = (): HTMLVideoElement => {
    const video = videoShowing([{ mode: 'showing', cues: ['A line'] }]);

    Object.defineProperty(video, 'videoWidth', { value: 1920 });
    Object.defineProperty(video, 'videoHeight', { value: 1080 });

    return video;
  };

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    Object.defineProperty(document, 'pictureInPictureEnabled', {
      configurable: true,
      value: true,
    });

    context.drawImage.mockClear();
    context.fillText.mockClear();
    requestPictureInPicture.mockClear().mockResolvedValue(undefined);

    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: () => context,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', {
      configurable: true,
      value: () => ({}),
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'play', {
      configurable: true,
      value: () => Promise.resolve(),
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'pause', {
      configurable: true,
      value: () => undefined,
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'requestPictureInPicture', {
      configurable: true,
      value: requestPictureInPicture,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('refuses where the browser will not float anything', async () => {
    Object.defineProperty(document, 'pictureInPictureEnabled', {
      configurable: true,
      value: false,
    });

    await expect(popOutWithCaptions(playable())).resolves.toBeNull();
  });

  it('floats a copy rather than the film itself, so the captions come with it', async () => {
    await popOutWithCaptions(playable());

    expect(requestPictureInPicture).toHaveBeenCalledOnce();
  });

  it('draws the film and its cues into the picture that floats', async () => {
    await popOutWithCaptions(playable());

    expect(context.drawImage).toHaveBeenCalled();
    expect(context.fillText).toHaveBeenCalledWith('A line', expect.anything(), expect.anything());
  });

  it('leaves the sound with the film, since a canvas has none', async () => {
    await popOutWithCaptions(playable());

    const surface = document.querySelector('video');

    expect(surface?.muted).toBe(true);
  });

  it('pauses the film when the little window is paused', async () => {
    const video = playable();
    const pause = vi.fn();

    Object.defineProperty(video, 'pause', { value: pause });

    await popOutWithCaptions(video);
    document.querySelector('video')?.dispatchEvent(new Event('pause'));

    expect(pause).toHaveBeenCalledOnce();
  });

  it('plays the film when the little window is played', async () => {
    const video = playable();
    const play = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(video, 'play', { value: play });

    await popOutWithCaptions(video);
    document.querySelector('video')?.dispatchEvent(new Event('play'));

    expect(play).toHaveBeenCalledOnce();
  });

  it('tidies the copy away when it is stopped', async () => {
    const popped = await popOutWithCaptions(playable());

    popped?.stop();

    expect(document.querySelector('video')).toBeNull();
  });

  it('tidies up and refuses when the browser will not float after all', async () => {
    requestPictureInPicture.mockRejectedValue(new Error('refused'));

    await expect(popOutWithCaptions(playable())).resolves.toBeNull();
    expect(document.querySelector('video')).toBeNull();
  });
});
