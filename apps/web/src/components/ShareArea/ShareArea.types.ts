import type { MediaSummary } from '@FluxContracts/schemas/Library';

type ShareAreaProps = {
  token: string;
  onPlay: (media: MediaSummary, startSeconds: number) => void;
  resumeFor?: (mediaId: string) => number | null;
  endedReason?: string | null;
  name?: string;
};

export type { ShareAreaProps };
