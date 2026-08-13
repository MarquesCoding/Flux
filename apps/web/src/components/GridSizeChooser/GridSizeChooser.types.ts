import type { MediaGridSize } from '@FluxWeb/components/MediaGrid/MediaGrid.types';

type GridSizeChooserProps = {
  value: MediaGridSize;
  onValueChange: (size: MediaGridSize) => void;
  className?: string;
};

export type { GridSizeChooserProps };
