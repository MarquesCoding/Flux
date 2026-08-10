import type { ReactNode } from 'react'

/**
 * The sections the sidebar offers.
 *
 * A closed set rather than free strings, so a section can never be navigated
 * to without something knowing how to draw it.
 */
const SHELL_SECTIONS = ['home', 'films', 'series', 'account', 'admin'] as const

type ShellSection = (typeof SHELL_SECTIONS)[number]

type AppShellProps = {
  section: ShellSection
  onSectionChange: (section: ShellSection) => void
  search: string
  onSearchChange: (search: string) => void
  account: ReactNode
  children: ReactNode
  /**
   * The colour the page is lit with, taken from whatever is being shown.
   */
  moodColor?: string | null
  /**
   * Whether this viewer administers the server. The section is hidden from
   * everyone else rather than shown and refused.
   */
  isAdministrator?: boolean
  /**
   * The name the shell carries, which an operator may have renamed.
   */
  brandName?: string
}

export type { AppShellProps, ShellSection }

export default { SHELL_SECTIONS }
