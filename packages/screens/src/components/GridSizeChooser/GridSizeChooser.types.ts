import type { MediaGridSize } from '@ValenceScreens/components/MediaGrid/MediaGrid.types';

type GridSizeChooserProps = {
  value: MediaGridSize;
  onValueChange: (size: MediaGridSize) => void;
  className?: string;
};

export type { GridSizeChooserProps };
