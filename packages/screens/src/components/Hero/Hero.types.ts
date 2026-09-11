import type { MoodLight } from '@ValenceUI/MoodBackground.types';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';

type HeroProps = {
  items: MediaSummary[];
  onInspect?: (media: MediaSummary) => void;
  onPalette?: (lights: MoodLight[]) => void;
  onPlay: (media: MediaSummary, startSeconds: number) => void;
  resumeFor?: (mediaId: string) => number | null;
  onFeatureChange?: (media: MediaSummary) => void;
  rotateAfterMilliseconds?: number;
  fills?: boolean;
  staysBehind?: boolean;
};

export type { HeroProps };
