type Tab = {
  id: string;
  label: string;
};

type TabBarProps = {
  tabs: Tab[];
  selectedId: string;
  onSelect: (id: string) => void;
  label: string;
  className?: string;
};

export type { Tab, TabBarProps };
