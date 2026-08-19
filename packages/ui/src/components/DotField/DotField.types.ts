type DotFieldFrame = (lifts: Float32Array, columns: number, rows: number, seconds: number) => void;

type DotFieldFilm = {
  seconds: number;
  lift: DotFieldFrame;
};

type DotFieldProps = {
  spacing?: number;
  sources?: number;
  seconds?: number;
  frame?: DotFieldFrame;
  className?: string;
};

export type { DotFieldFilm, DotFieldFrame, DotFieldProps };
