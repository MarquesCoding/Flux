type FilterOption = {
  /**
   * What choosing this asks the server for.
   */
  value: string;
  label: string;
};

type FilterChipsProps = {
  /**
   * What the row of chips narrows — "Decade", "Rating", and so on.
   *
   * Read out as the group's name, so somebody hearing the page is told what
   * "1990s" is a choice about.
   */
  legend: string;
  options: FilterOption[];
  /**
   * What is chosen, or nothing.
   */
  value: string | null;
  /**
   * Told the new choice, or nothing when the chosen one was pressed again.
   *
   * Pressing the chosen chip clears it rather than doing nothing: a filter
   * somebody can only add is a filter they have to hunt for a way out of.
   */
  onValueChange: (next: string | null) => void;
};

export type { FilterChipsProps, FilterOption };
