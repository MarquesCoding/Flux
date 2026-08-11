import type { MoodLight } from '@FluxUI/MoodBackground.types'
import type { ReactNode } from 'react'

/**
 * The places the bar can take a viewer.
 *
 * The first five are named across the middle of the bar; the rest are reached
 * from the tools at its right, because searching, notifications and the
 * account are things you do rather than places to browse.
 */
const SHELL_SECTIONS = [
  'home',
  'shows',
  'films',
  'new',
  'favourites',
  'search',
  'account',
  'admin',
] as const

/**
 * The places named in the middle of the bar, in the order they are read.
 */
const BROWSE_SECTIONS = ['home', 'shows', 'films', 'new', 'favourites'] as const

type ShellSection = (typeof SHELL_SECTIONS)[number]

type AppShellProps = {
  section: ShellSection
  onSectionChange: (section: ShellSection) => void
  children: ReactNode
  /**
   * The colours the page is lit by, read from what is on screen.
   */
  moodLights?: MoodLight[]
  /**
   * Whether this viewer administers the server. The section is hidden from
   * everyone else rather than shown and refused.
   */
  isAdministrator?: boolean
  /**
   * The face to draw on the account button, when this viewer has one.
   */
  avatar?: ReactNode
  /**
   * Opens something chosen at random.
   *
   * Left out where there is nothing to choose from, and the control is not
   * drawn at all rather than drawn and refusing.
   */
  onSurprise?: () => void
}

export type { AppShellProps, ShellSection }

export default { SHELL_SECTIONS, BROWSE_SECTIONS }
