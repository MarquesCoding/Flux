import type { ShareEnding } from '@ValenceContracts/schemas/Share';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';

type ShareAreaProps = {
  token: string;
  onPlay: (media: MediaSummary, startSeconds: number) => void;
  resumeFor?: (mediaId: string) => number | null;
  ended?: ShareEnding | null;
  name?: string;
};

export type { ShareAreaProps };
