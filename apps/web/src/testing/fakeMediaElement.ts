type FakeMediaControls = {
  loaded: (options: { seekableTo?: number; bufferedTo?: number; duration?: number }) => void;
  addTextTrack: (options?: {
    mode?: TextTrackMode;
    cues?: { startTime: number; endTime: number }[];
  }) => { mode: TextTrackMode; cues: { startTime: number; endTime: number }[] };
  presentFrame: (mediaTime: number) => void;
  popOut: () => void;
  popBack: () => void;
  playTo: (seconds: number) => void;
  stop: () => void;
};

/**
 * Fills in the parts of a video element jsdom does not have.
 */
const fakeMediaElement = (element: HTMLElement): FakeMediaControls => {
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
