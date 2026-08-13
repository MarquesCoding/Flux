type PageDotsProps = {
  count: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  /**
   * What each one is, where they have names.
   *
   * Shown above the marker being pointed at, and used as its accessible name.
   * Left out where the things being paged through are pages rather than items,
   * since "page three" is what the position already says.
   */
  labels?: string[];
  /**
   * What the row as a whole is for, for anybody who cannot see it.
   */
  label?: string;
  className?: string;
  /**
   * How long the current marker takes to fill, when something is moving on by
   * itself.
   *
   * A carousel that changes on a timer changes without warning: the thing
   * being read is replaced mid-sentence and nothing said it was about to
   * happen. Filling the marker is the warning, and it doubles as the answer to
   * "how long have I got" — which is what somebody deciding whether to press
   * Play actually wants to know.
   *
   * Left unset wherever the markers describe something that only moves when
   * asked to, such as a row scrolled by hand: a bar filling on its own there
   * would promise a change that never comes.
   */
  fillMilliseconds?: number;
  /**
   * Whether the filling has stopped, because whatever it was counting down to
   * has been suspended — a pointer resting on the thing being counted, say.
   */
  isFillPaused?: boolean;
};

export type { PageDotsProps };
