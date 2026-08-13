/**
 * What a test can do to a video element once it has been filled in.
 */
type FakeMediaControls = {
  /**
   * Says how much of the stream can be seeked within, and how much has
   * arrived. jsdom reports neither, so anything reading a buffer sees nothing.
   */
  loaded: (options: { seekableTo?: number; bufferedTo?: number; duration?: number }) => void;
  /**
   * Adds a subtitle track carrying cues, which is the only way to exercise
   * anything that moves subtitles about.
   */
  addTextTrack: (options?: {
    mode?: TextTrackMode;
    cues?: { startTime: number; endTime: number }[];
  }) => { mode: TextTrackMode; cues: { startTime: number; endTime: number }[] };
  /**
   * Hands the next frame to whatever asked for one, with the media time it
   * claims to be showing.
   */
  presentFrame: (mediaTime: number) => void;
  /**
   * Puts the element into, or out of, the browser's floating window.
   */
  popOut: () => void;
  popBack: () => void;
  /**
   * Says how far along the element is, and tells anything listening.
   */
  playTo: (seconds: number) => void;
  stop: () => void;
};

/**
 * Fills in the parts of a video element jsdom does not have.
 *
 * jsdom implements `<video>` as an inert box: no pipeline, no buffered or
 * seekable ranges, no text tracks that hold cues, no frame callbacks, and no
 * picture-in-picture. Everything a player does in response to playback is
 * therefore unreachable in a test unless the element is filled in first, which
 * is why the half of `VideoPlayer` that reacts to the stream went untested for
 * so long.
 *
 * This fills it in rather than replacing it: the element under test is the one
 * React rendered, so what is exercised is the real component against a
 * believable element, not a mock of the component's own idea of one.
 *
 * Everything installed is `configurable`, so a test that finishes leaves the
 * prototype as it found it — the element itself is thrown away with the DOM.
 */
const fakeMediaElement = (element: HTMLElement): FakeMediaControls => {
  /**
   * A track list, not merely an array of tracks.
   *
   * The surface listens for tracks arriving and leaving, so a bare array fails
   * the moment the component mounts — which is every test, not only the ones
   * about subtitles.
   */
  const tracks: {
    mode: TextTrackMode;
    cues: { startTime: number; endTime: number }[];
  }[] & {
    addEventListener?: () => void;
    removeEventListener?: () => void;
  } = [];

  tracks.addEventListener = () => undefined;
  tracks.removeEventListener = () => undefined;
  const frameCallbacks: ((now: number, metadata: { mediaTime: number }) => void)[] = [];

  /**
   * Installs one of the things jsdom leaves off a media element.
   *
   * Typed loosely on purpose: what goes on is a number, a range, a list or a
   * function depending on the property, and naming that union would be a
   * description of jsdom's gaps rather than of anything Flux has.
   */
  const define = (name: string, value: object | number | boolean | null) => {
    Object.defineProperty(element, name, { configurable: true, writable: true, value });
  };

  const range = (end: number) => ({ length: end > 0 ? 1 : 0, start: () => 0, end: () => end });

  define('play', () => {
    define('paused', false);
    element.dispatchEvent(new Event('play'));
    element.dispatchEvent(new Event('playing'));

    return Promise.resolve();
  });

  define('pause', () => {
    define('paused', true);
    element.dispatchEvent(new Event('pause'));
  });

  define('paused', true);
  define('readyState', 4);
  define('videoWidth', 1920);
  define('videoHeight', 1080);
  define('currentTime', 0);
  define('duration', 0);
  define('buffered', range(0));
  define('seekable', range(0));
  define('textTracks', tracks);

  define(
    'requestVideoFrameCallback',
    (callback: (now: number, metadata: { mediaTime: number }) => void) => {
      frameCallbacks.push(callback);

      return frameCallbacks.length;
    },
  );

  define('cancelVideoFrameCallback', () => undefined);

  define('requestPictureInPicture', () => {
    Object.defineProperty(document, 'pictureInPictureElement', {
      configurable: true,
      writable: true,
      value: element,
    });

    return Promise.resolve({});
  });

  Object.defineProperty(document, 'pictureInPictureEnabled', {
    configurable: true,
    writable: true,
    value: true,
  });

  Object.defineProperty(document, 'pictureInPictureElement', {
    configurable: true,
    writable: true,
    value: null,
  });

  Object.defineProperty(document, 'exitPictureInPicture', {
    configurable: true,
    writable: true,
    value: () => {
      Object.defineProperty(document, 'pictureInPictureElement', {
        configurable: true,
        writable: true,
        value: null,
      });

      return Promise.resolve();
    },
  });

  return {
    loaded: ({ seekableTo, bufferedTo, duration }) => {
      if (duration !== undefined) {
        define('duration', duration);
      }

      if (seekableTo !== undefined) {
        define('seekable', range(seekableTo));
      }

      if (bufferedTo !== undefined) {
        define('buffered', range(bufferedTo));
      }

      element.dispatchEvent(new Event('progress'));
    },

    addTextTrack: ({ mode = 'showing', cues = [] } = {}) => {
      const track = { mode, cues };

      tracks.push(track);

      return track;
    },

    presentFrame: (mediaTime) => {
      const next = frameCallbacks.shift();

      next?.(0, { mediaTime });
    },

    popOut: () => {
      Object.defineProperty(document, 'pictureInPictureElement', {
        configurable: true,
        writable: true,
        value: element,
      });
    },

    popBack: () => {
      Object.defineProperty(document, 'pictureInPictureElement', {
        configurable: true,
        writable: true,
        value: null,
      });
    },

    playTo: (seconds) => {
      define('currentTime', seconds);
      element.dispatchEvent(new Event('timeupdate'));
    },

    stop: () => {
      element.dispatchEvent(new Event('ended'));
    },
  };
};

export type { FakeMediaControls };

export { fakeMediaElement };
