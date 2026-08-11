import type { CaptionStyle } from '@FluxWeb/playback/captionStyle';

type CaptionSettingsProps = {
  style: CaptionStyle;
  onChange: (style: CaptionStyle) => void;
  onReset: () => void;
};

export type { CaptionSettingsProps };
