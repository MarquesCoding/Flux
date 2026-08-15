type SectionBarItem = {
  id: string;
  label: string;
};

type SectionBarGroup = {
  label?: string;
  items: readonly SectionBarItem[];
};

type SectionBarProps = {
  label: string;
  groups: readonly SectionBarGroup[];
  value: string;
  onValueChange: (id: string) => void;
  className?: string;
};

export type { SectionBarGroup, SectionBarItem, SectionBarProps };
