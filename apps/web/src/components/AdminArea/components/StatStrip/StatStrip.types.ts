import type { ReactNode } from 'react'

type Stat = {
  label: string
  value: string
  /**
   * The smaller line under the figure: what it is of, or what it means.
   */
  detail?: string
  icon: ReactNode
  /**
   * How full the thing being measured is, when it has a limit.
   *
   * Drawn as a line under the figure. Absent for counts, which have no
   * ceiling to be a fraction of.
   */
  fraction?: number
}

type StatStripProps = {
  stats: Stat[]
}

export type { Stat, StatStripProps }
