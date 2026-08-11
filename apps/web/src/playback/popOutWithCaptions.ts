/**
 * How many frames a second the composed picture is offered at.
 *
 * A floating window is small and nobody is studying it. Matching the film
 * exactly would mean drawing every frame of a fifty frame source into a canvas
 * for the sake of a thumbnail.
 */
const FRAMES_PER_SECOND = 30;

/**
 * How wide the composed picture is drawn, at most.
 *
 * A picture-in-picture window is a few hundred pixels across. Drawing a 4K
 * frame into a canvas thirty times a second to shrink it into that would cost
 * more than playing the film does.
 */
const MAX_WIDTH = 1280;

/**
 * How large the caption text is, as a fraction of the picture's height.
 */
const TEXT_SCALE = 0.062;

/**
 * How far above the bottom edge captions sit.
 */
const BASELINE = 0.055;

/**
 * What is running, so it can be stopped.
 */
type PoppedOut = {
  stop: () => void;
};

/**
 * The cues showing on a video at this moment, as plain lines.
 *
 * Read from whichever track is on rather than from Flux's own state: the
 * browser is the thing that decides which cue is current, and asking it is
 * both simpler and always right.
 */
const currentLines = (video: HTMLVideoElement): string[] => {
  const lines: string[] = [];

  for (const track of Array.from(video.textTracks)) {
    if (track.mode === 'disabled') {
      continue;
    }

    for (const cue of Array.from(track.activeCues ?? [])) {
      const text = 'text' in cue && typeof cue.text === 'string' ? cue.text : '';

      for (const line of text.replaceAll(/<[^>]*>/g, '').split('\n')) {
        if (line.trim() !== '') {
          lines.push(line.trim());
        }
      }
    }
  }

  return lines;
};

/**
 * Draws one frame of the film with its captions burned into it.
 */
const compose = (
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
): void => {
  context.drawImage(video, 0, 0, width, height);

  const lines = currentLines(video);

  if (lines.length === 0) {
    return;
  }

  const size = Math.round(height * TEXT_SCALE);

  context.font = `600 ${size.toString()}px system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'bottom';
  context.lineJoin = 'round';
  context.lineWidth = Math.max(2, size * 0.16);
  context.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  context.fillStyle = '#ffffff';

  const bottom = height - height * BASELINE;

  for (const [at, line] of [...lines].reverse().entries()) {
    const y = bottom - at * size * 1.25;

    context.strokeText(line, width / 2, y);
    context.fillText(line, width / 2, y);
  }
};

/**
 * Pops a film out with its subtitles still on it.
 *
 * A floating window shows the video element and nothing layered over it, so
 * captions — which a browser draws as an overlay — simply vanish. The way
 * round it is to stop giving the window the original video at all: the frames
 * and the cues are drawn together into a canvas, and the canvas is what
 * floats.
 *
 * Sound stays with the original element, since a canvas has none. The floating
 * copy is silent and its controls are forwarded, so pausing the little window
 * pauses the film rather than freezing a picture of it while the audio
 * carries on.
 *
 * Returns null when the browser will not float anything, so a caller can fall
 * back to asking it directly.
 */
const popOutWithCaptions = async (video: HTMLVideoElement): Promise<PoppedOut | null> => {
  if (!document.pictureInPictureEnabled) {
    return null;
  }

  const ratio = video.videoHeight === 0 ? 9 / 16 : video.videoHeight / video.videoWidth;
  const width = Math.min(video.videoWidth === 0 ? MAX_WIDTH : video.videoWidth, MAX_WIDTH);
  const height = Math.round(width * ratio);

  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (context === null) {
    return null;
  }

  const surface = document.createElement('video');

  surface.style.position = 'fixed';
  surface.style.opacity = '0';
  surface.style.pointerEvents = 'none';
  surface.style.width = '1px';
  surface.style.height = '1px';
  surface.muted = true;
  surface.playsInline = true;
  surface.srcObject = canvas.captureStream(FRAMES_PER_SECOND);

  document.body.append(surface);

  let frame = 0;

  const tick = () => {
    compose(context, video, width, height);
    frame = requestAnimationFrame(tick);
  };

  const stop = () => {
    cancelAnimationFrame(frame);
    surface.srcObject = null;
    surface.remove();
  };

  surface.addEventListener('pause', () => {
    video.pause();
  });

  surface.addEventListener('play', () => {
    void video.play().catch(() => {});
  });

  surface.addEventListener('leavepictureinpicture', stop, { once: true });

  try {
    tick();

    await surface.play();
    await surface.requestPictureInPicture();
  } catch {
    stop();

    return null;
  }

  return { stop };
};

export type { PoppedOut };

export { popOutWithCaptions, currentLines };
