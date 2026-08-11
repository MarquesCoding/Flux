import type { MoodLight } from '@FluxUI/MoodBackground.types'
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
   * The colours the page is lit by, read from what is on screen.
   */
  moodLights?: MoodLight[]
  /**
   * Whether this viewer administers the server. The section is hidden from
   * everyone else rather than shown and refused.
   */
  isAdministrator?: boolean
}

export type { AppShellProps, ShellSection }

export default { SHELL_SECTIONS }
