import type { DotFieldFrame } from '@ValenceUI/DotField.types';

type MoodLight = {
  color: string;
  at?: string;
};

type MoodBackgroundProps = {
  hasGrid?: boolean;
  isDrifting?: boolean;
  lights?: MoodLight[];
  film?: DotFieldFrame | null;
};

export type { MoodBackgroundProps, MoodLight };
