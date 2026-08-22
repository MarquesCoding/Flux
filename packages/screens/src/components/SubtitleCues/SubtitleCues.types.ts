import type { CaptionStyle } from '@FluxScreens/playback/captionStyle';

type SubtitleCuesProps = {
  src: string;
  atSeconds: number;
  style: CaptionStyle;
  isLifted?: boolean;
};

export type { SubtitleCuesProps };
