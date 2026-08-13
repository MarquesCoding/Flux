type SectionBarItem = {
  id: string;
  label: string;
};

/**
 * A family of sections, which a bar shows as one place.
 *
 * A group with a label opens; a group without one is its items, shown as
 * themselves. That is how the first section of a page — the one everybody
 * arrives at — stays a single press rather than becoming a menu of one.
 */
type SectionBarGroup = {
  label?: string;
  items: readonly SectionBarItem[];
};

type SectionBarProps = {
  /**
   * What the bar chooses between, for whoever cannot see it.
   */
  label: string;
  groups: readonly SectionBarGroup[];
  /**
   * Which section is showing.
   */
  value: string;
  onValueChange: (id: string) => void;
  className?: string;
};

export type { SectionBarGroup, SectionBarItem, SectionBarProps };
