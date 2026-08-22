type TabRowItem = {
  id: string;
  label: string;
};

type TabRowGroup = {
  label?: string;
  items: readonly TabRowItem[];
};

type TabRowSize = 'sm' | 'md';

type TabRowTone = 'track' | 'underlined';

type TabRowProps = {
  label: string;
  size?: TabRowSize;
  tone?: TabRowTone;
  groups: readonly TabRowGroup[];
  value?: string;
  className?: string;
};

export type { TabRowProps, TabRowGroup, TabRowItem, TabRowSize, TabRowTone };
