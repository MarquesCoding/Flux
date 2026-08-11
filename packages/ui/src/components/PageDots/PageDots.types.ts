type PageDotsProps = {
  count: number
  selectedIndex: number
  onSelect: (index: number) => void
  /**
   * What each one is, where they have names.
   *
   * Shown above the marker being pointed at, and used as its accessible name.
   * Left out where the things being paged through are pages rather than items,
   * since "page three" is what the position already says.
   */
  labels?: string[]
  /**
   * What the row as a whole is for, for anybody who cannot see it.
   */
  label?: string
  className?: string
}

export type { PageDotsProps }
