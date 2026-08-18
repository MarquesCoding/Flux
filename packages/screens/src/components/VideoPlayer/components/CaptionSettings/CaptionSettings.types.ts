import type { CaptionStyle } from '@FluxScreens/playback/captionStyle';

type CaptionSettingsProps = {
  style: CaptionStyle;
  onChange: (style: CaptionStyle) => void;
  onReset: () => void;
};

export type { CaptionSettingsProps };
