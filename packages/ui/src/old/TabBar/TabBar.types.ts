type Tab = {
  id: string;
  label: string;
};

type TabBarProps = {
  tabs: Tab[];
  label: string;
  value?: string;
  className?: string;
};

export type { Tab, TabBarProps };
