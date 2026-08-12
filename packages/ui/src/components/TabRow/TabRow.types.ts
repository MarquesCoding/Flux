type TabRowItem = {
  id: string;
  label: string;
};

type TabRowGroup = {
  /**
   * What the group is called. Not drawn — a row has no room for headings —
   * but kept so the grouping survives, and read out to whoever cannot see the
   * rule that stands in for it.
   */
  label?: string;
  items: readonly TabRowItem[];
};

type TabRowProps = {
  /**
   * What the row chooses between, for whoever cannot see it.
   */
  label: string;
  groups: readonly TabRowGroup[];
  className?: string;
};

export type { TabRowGroup, TabRowItem, TabRowProps };
