type DrawingContext = {
  drawImage: (
    source: HTMLVideoElement,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
};

/**
 * What this needs from a canvas, and nothing more.
 *
 * Narrower than `HTMLCanvasElement` so the capture can be tested without a
 * rendering engine, which jsdom does not have.
 */
type DrawingSurface = {
  width: number;
  height: number;
  getContext: (kind: '2d') => DrawingContext | null;
  toDataURL: (type: string, quality: number) => string;
};

/**
 * Takes a still of whatever the player is showing.
 *
 * Used to hold the last frame on screen while a seek restarts the stream.
 * Without it the media element goes black the moment the old session is torn
 * down, which reads as the video having broken rather than as a seek.
 *
 * Answers with nothing rather than throwing when there is no frame to take:
 * this is decoration, and a seek must not fail because a still could not be
 * made.
 */
const captureFrame = (element: HTMLVideoElement, canvas: DrawingSurface): string | null => {
  if (element.videoWidth === 0 || element.videoHeight === 0) {
    return null;
  }

  canvas.width = element.videoWidth;
  canvas.height = element.videoHeight;

  const context = canvas.getContext('2d');

  if (context === null) {
    return null;
  }

  try {
    context.drawImage(element, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return null;
  }
};

export type { DrawingContext, DrawingSurface };

export { captureFrame };
