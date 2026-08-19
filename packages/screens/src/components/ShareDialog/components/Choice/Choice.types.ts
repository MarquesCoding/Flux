type ChoiceProps = {
  label: string;
  options: readonly { id: string; label: string }[];
  value: string;
  onSelect: (id: string) => void;
};

export type { ChoiceProps };
