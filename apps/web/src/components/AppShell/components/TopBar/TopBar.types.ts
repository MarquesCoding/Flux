import type { ReactNode } from 'react'

type TopBarProps = {
  search: string
  onSearchChange: (search: string) => void
  /**
   * Drawn at the right, after the search. The account lives here.
   */
  account: ReactNode
  /**
   * Whether the bar has content scrolled beneath it.
   *
   * A bar over the top of a hero should be invisible; the same bar over a wall
   * of text needs something to sit on.
   */
  isLifted?: boolean
}

export type { TopBarProps }
