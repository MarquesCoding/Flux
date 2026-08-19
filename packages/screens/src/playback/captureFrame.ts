type DrawingContext = {
  drawImage: (
    source: HTMLVideoElement,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
};

type DrawingSurface = {
  width: number;
  height: number;
  getContext: (kind: '2d') => DrawingContext | null;
  toDataURL: (type: string, quality: number) => string;
};

/**
 * Takes a still of whatever the player is showing, so the picture can be held on screen while a
 * session is torn down and another started — without it, changing quality or track blanks the
 * element and reads as the player breaking.
 *
 * @param element - The video element to capture.
 * @param canvas - A canvas to draw into.
 * @returns The still as a data address, or null where the frame could not be read.
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

export type { DrawingSurface };

export { captureFrame };
