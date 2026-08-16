import type { MoodLight } from '@FluxUI/MoodBackground.types';
import type { MediaSummary } from '@FluxContracts/schemas/Library';

type HeroProps = {
  items: MediaSummary[];
  onInspect?: (media: MediaSummary) => void;
  onPalette?: (lights: MoodLight[]) => void;
  onPlay: (media: MediaSummary, startSeconds: number) => void;
  resumeFor?: (mediaId: string) => number | null;
  onFeatureChange?: (media: MediaSummary) => void;
  rotateAfterMilliseconds?: number;
};

export type { HeroProps };
