type FilterOption = {
  value: string;
  label: string;
};

type FilterChipsProps = {
  legend: string;
  options: FilterOption[];
  value: string | null;
  onValueChange: (next: string | null) => void;
};

export type { FilterChipsProps, FilterOption };
