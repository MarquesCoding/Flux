import type { ReactNode } from 'react'

/**
 * The places the dock can take a viewer.
 *
 * Deliberately few. A dock with eight icons is a menu, and a menu belongs
 * behind one of them rather than across the bottom of every screen.
 */
const SHELL_SECTIONS = ['home', 'search', 'account', 'admin'] as const

type ShellSection = (typeof SHELL_SECTIONS)[number]

type AppShellProps = {
  section: ShellSection
  onSectionChange: (section: ShellSection) => void
  children: ReactNode
  /**
   * What counts as a different page for the purposes of animating between
   * them.
   *
   * Sections that draw the same thing — a library, whether browsed or searched
   * — share a key, so moving between them keeps the page rather than throwing
   * it away and fetching it again. Defaults to the section itself.
   */
  viewKey?: string
  /**
   * The colour the page is lit with, taken from whatever is being shown.
   */
  moodColor?: string | null
  /**
   * Whether this viewer administers the server. The section is hidden from
   * everyone else rather than shown and refused.
   */
  isAdministrator?: boolean
}

export type { AppShellProps, ShellSection }

export default { SHELL_SECTIONS }
