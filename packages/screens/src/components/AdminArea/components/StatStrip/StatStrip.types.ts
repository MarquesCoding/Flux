type Stat = {
  label: string;
  value: string;
  detail?: string;
  fraction?: number;
};

type StatStripProps = {
  stats: Stat[];
};

export type { Stat, StatStripProps };
