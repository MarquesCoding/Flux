import { useEffect } from 'react'
import { IconHome, IconSearch, IconSettings, IconUserCircle } from '@tabler/icons-react'
import { motion, useReducedMotion } from 'motion/react'
import DockModule from '@FluxUI/Dock'
import MoodBackgroundModule from '@FluxUI/MoodBackground'
import revealModule from '@FluxUI/animations/reveal'
import type { ReactNode } from 'react'
import type { DockItem } from '@FluxUI/Dock.types'
import type { AppShellProps, ShellSection } from './AppShell.types'

const { Dock } = DockModule
const { MoodBackground } = MoodBackgroundModule
const { revealVariants, revealTransition, staggerVariants } = revealModule

const SECTION_ICONS: Record<ShellSection, ReactNode> = {
  home: <IconHome size={22} aria-hidden />,
  search: <IconSearch size={22} aria-hidden />,
  account: <IconUserCircle size={22} aria-hidden />,
  admin: <IconSettings size={22} aria-hidden />,
}

const SECTION_LABELS: Record<ShellSection, string> = {
  home: 'Home',
  search: 'Search',
  account: 'Account',
  admin: 'Admin',
}

/**
 * The frame everything is drawn inside.
 *
 * There is no chrome down the side and none across the top: the library gets
 * the whole surface, and the few places worth going float over it in a dock at
 * the bottom, where a thumb already is. The same arrangement works on a phone
 * and on a desktop, which is why it is the arrangement — a rail that collapses
 * is two designs pretending to be one.
 *
 * Sections arrive rather than appear. The page is keyed on the section, so
 * moving between them animates out and in instead of swapping silently.
 */
const AppShell = ({
  section,
  onSectionChange,
  children,
  viewKey,
  moodColor,
  isAdministrator = false,
}: AppShellProps) => {
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (section === 'home') {
      return
    }

    // Escape is what everyone tries to get out of a place they have wandered
    // into. Home is where it lets them out.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onSectionChange('home')
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [section, onSectionChange])

  // A new section starts at the top of itself. Arriving at search from halfway
  // down the library and landing halfway down the results is a page that has
  // kept somebody else's place, and it drags the dock's highlight across a
  // page moving underneath it.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [section])

  const sections: ShellSection[] = isAdministrator
    ? ['home', 'search', 'account', 'admin']
    : ['home', 'search', 'account']

  const items: DockItem[] = sections.map((id) => ({
    id,
    label: SECTION_LABELS[id],
    icon: SECTION_ICONS[id],
  }))

  return (
    <div className="relative min-h-screen text-text">
      <MoodBackground color={moodColor ?? null} hasGrid={section === 'home'} />

      <motion.main
        key={viewKey ?? section}
        variants={staggerVariants}
        initial="hidden"
        animate="shown"
        // Room for the dock, which floats over the top of the page rather
        // than taking a strip of it.
        className="min-h-screen pb-16"
      >
        <motion.div
          variants={revealVariants(prefersReducedMotion)}
          transition={revealTransition(prefersReducedMotion, 'heavy')}
        >
          {children}
        </motion.div>
      </motion.main>

      <Dock
        items={items}
        selectedId={section}
        onSelect={(id) => {
          const chosen = sections.find((candidate) => candidate === id)

          if (chosen !== undefined) {
            onSectionChange(chosen)
          }
        }}
      />
    </div>
  )
}

AppShell.displayName = 'AppShell'

export default { AppShell }
