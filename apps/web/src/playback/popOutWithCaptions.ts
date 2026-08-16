const FRAMES_PER_SECOND = 30;

const MAX_WIDTH = 1280;

const TEXT_SCALE = 0.062;

const BASELINE = 0.055;

type PoppedOut = {
  stop: () => void;
};

/**
 * Reads the cues showing on a video at this moment as plain lines, since a picture-in-picture window
 * carries no text tracks of its own.
 *
 * @param video - The video element being read.
 * @returns The lines showing now.
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
 * Draws one frame of the film with its captions painted into it, which is the only way captions can
 * appear in a picture-in-picture window.
 *
 * @param context - The canvas to draw into.
 * @param video - The video to read the frame and its captions from.
 * @param width - How wide the canvas is.
 * @param height - How tall it is.
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
 * Pops a film out into a floating window with its subtitles still on it, by drawing each frame with
 * the captions painted in — a picture-in-picture window shows a video element and nothing else, so
 * subtitles that live in a text track simply vanish.
 *
 * @param video - The video to pop out, and how its captions should look.
 * @returns A handle on the window, for closing it and keeping it in step.
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
