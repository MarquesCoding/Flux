import type { ShareEnding } from '@FluxContracts/schemas/Share';
import type { MediaSummary } from '@FluxContracts/schemas/Library';

type ShareAreaProps = {
  token: string;
  onPlay: (media: MediaSummary, startSeconds: number) => void;
  resumeFor?: (mediaId: string) => number | null;
  ended?: ShareEnding | null;
  name?: string;
};

export type { ShareAreaProps };
