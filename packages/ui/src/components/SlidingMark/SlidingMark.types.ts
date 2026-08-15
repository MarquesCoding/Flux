type SlidingMarkProps = {
  /**
   * Which set of controls this mark belongs to.
   *
   * One mark travels between every control sharing a group, so two rows on the
   * same page each need their own name — a shared one would have a single mark
   * flying between the dock and whatever else claimed it.
   */
  group: string;
  className?: string;
};

export type { SlidingMarkProps };
