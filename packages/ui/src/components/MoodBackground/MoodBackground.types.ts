type MoodLight = {
  color: string;
  at?: string;
};

type MoodBackgroundProps = {
  hasGrid?: boolean;
  isDrifting?: boolean;
  lights?: MoodLight[];
};

export type { MoodBackgroundProps, MoodLight };
