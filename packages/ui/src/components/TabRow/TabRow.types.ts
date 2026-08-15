type TabRowItem = {
  id: string;
  label: string;
};

type TabRowGroup = {
  label?: string;
  items: readonly TabRowItem[];
};

type TabRowProps = {
  label: string;
  groups: readonly TabRowGroup[];
  className?: string;
};

export type { TabRowProps };
