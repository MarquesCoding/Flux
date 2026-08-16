type PageDotsProps = {
  count: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  labels?: string[];
  label?: string;
  className?: string;
  fillMilliseconds?: number;
  isFillPaused?: boolean;
};

export type { PageDotsProps };
