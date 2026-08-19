type MaskFrames = {
  width: number;
  height: number;
  frames: number;
  fps: number;
  at: (frame: number) => Uint8Array;
};

export type { MaskFrames };
