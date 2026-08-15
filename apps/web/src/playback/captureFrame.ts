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
 * Takes a still of whatever the player is showing.
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
