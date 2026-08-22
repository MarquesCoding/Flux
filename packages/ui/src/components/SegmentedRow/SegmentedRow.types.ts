type SegmentedItem = {
  id: string;
  label: string;
  isAbsent?: boolean;
};

type SegmentedSize = 'sm' | 'md';

type SegmentedTone = 'inverted' | 'accent';

type SegmentedRowProps = {
  label: string;
  size?: SegmentedSize;
  tone?: SegmentedTone;
  items: readonly SegmentedItem[];
  value: string;
  onSelect: (id: string) => void;
  className?: string;
};

export type { SegmentedItem, SegmentedRowProps, SegmentedSize, SegmentedTone };
