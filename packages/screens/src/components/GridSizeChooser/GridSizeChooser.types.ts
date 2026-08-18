import type { MediaGridSize } from '@FluxScreens/components/MediaGrid/MediaGrid.types';

type GridSizeChooserProps = {
  value: MediaGridSize;
  onValueChange: (size: MediaGridSize) => void;
  className?: string;
};

export type { GridSizeChooserProps };
