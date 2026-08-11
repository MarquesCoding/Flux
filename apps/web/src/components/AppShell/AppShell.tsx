import { useEffect } from 'react'
import {
  IconClock,
  IconHeart,
  IconHome,
  IconMovie,
  IconSearch,
  IconSettings,
  IconTrendingUp,
  IconUserCircle,
} from '@tabler/icons-react'
import { motion, useReducedMotion } from 'motion/react'
import TopNavModule from '@FluxUI/TopNav'
import MoodBackgroundModule from '@FluxUI/MoodBackground'
import revealModule from '@FluxUI/animations/reveal'
import NotificationBellModule from './components/NotificationBell/NotificationBell'
import AppShellTypesModule from './AppShell.types'
import type { ReactNode } from 'react'
import type { TopNavAction, TopNavItem } from '@FluxUI/TopNav.types'
import type { AppShellProps, ShellSection } from './AppShell.types'

const { TopNav } = TopNavModule
const { MoodBackground } = MoodBackgroundModule
const { revealVariants, revealTransition, staggerVariants } = revealModule
const { NotificationBell } = NotificationBellModule
const { BROWSE_SECTIONS } = AppShellTypesModule

/**
 * The mark each place carries while it is the one being stood on.
 */
const SECTION_ICONS: Record<ShellSection, ReactNode> = {
  home: <IconHome size={16} aria-hidden />,
  shows: <IconClock size={16} aria-hidden />,
  films: <IconMovie size={16} aria-hidden />,
  new: <IconTrendingUp size={16} aria-hidden />,
  favourites: <IconHeart size={16} aria-hidden />,
  search: <IconSearch size={16} aria-hidden />,
  account: <IconUserCircle size={16} aria-hidden />,
  admin: <IconSettings size={16} aria-hidden />,
}

const SECTION_LABELS: Record<ShellSection, string> = {
  home: 'Home',
  shows: 'Shows',
  films: 'Films',
  new: 'New & Popular',
  favourites: 'Favourites',
  search: 'Search',
  account: 'Account',
  admin: 'Admin',
}

/**
 * The frame everything is drawn inside.
 *
 * A bar across the top rather than a dock at the bottom, and sectioned: the
 * places in the middle, the tools at the right. The library still gets the
 * whole surface — the bar is lettering over the artwork until the page moves
 * under it, at which point it earns a background.
 *
 * Sections arrive rather than appear. The page is keyed on the section, so
 * moving between them animates out and in instead of swapping silently.
 */
const AppShell = ({
  section,
  onSectionChange,
  children,
  moodLights = [],
  isAdministrator = false,
  avatar,
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
  // kept somebody else's place.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [section])

  const items: TopNavItem[] = BROWSE_SECTIONS.map((id) => ({
    id,
    label: SECTION_LABELS[id],
    icon: SECTION_ICONS[id],
  }))

  const actions: TopNavAction[] = [
    {
      id: 'search',
      label: 'Search',
      icon: <IconSearch size={20} aria-hidden />,
      isCurrent: section === 'search',
      onSelect: () => {
        onSectionChange('search')
      },
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: null,
      // Its own control: the bell opens a panel where it stands rather than
      // going anywhere, and a button inside a button is not a thing a browser
      // will make sense of.
      control: <NotificationBell />,
      onSelect: () => {
        // Nothing to go to.
      },
    },
    ...(isAdministrator
      ? [
          {
            id: 'admin',
            label: 'Admin',
            icon: <IconSettings size={20} aria-hidden />,
            isCurrent: section === 'admin',
            onSelect: () => {
              onSectionChange('admin')
            },
          },
        ]
      : []),
    {
      id: 'account',
      label: 'Account',
      icon: avatar ?? <IconUserCircle size={22} aria-hidden />,
      isCurrent: section === 'account',
      onSelect: () => {
        onSectionChange('account')
      },
    },
  ]

  return (
    <div className="relative min-h-screen text-text">
      {/* The wash, without the grid. A field of dots belongs to the way in,
          where there is nothing else on the screen to compete with it; behind
          a library it is a texture under artwork. */}
      <MoodBackground lights={moodLights} />

      <TopNav
        items={items}
        selectedId={section}
        actions={actions}
        onSelect={(id) => {
          const chosen = BROWSE_SECTIONS.find((candidate) => candidate === id)

          if (chosen !== undefined) {
            onSectionChange(chosen)
          }
        }}
      />

      <motion.main
        // One key per section. Home and search once drew the same library and
        // shared a page between them; search has its own now, and holding them
        // together meant swapping one page's contents for another's inside a
        // subtree that never changed — which reads as the page breaking rather
        // than as going somewhere.
        key={section}
        variants={staggerVariants}
        initial="hidden"
        animate="shown"
        className="min-h-screen pb-16"
      >
        <motion.div
          variants={revealVariants(prefersReducedMotion)}
          transition={revealTransition(prefersReducedMotion, 'heavy')}
        >
          {children}
        </motion.div>
      </motion.main>
    </div>
  )
}

AppShell.displayName = 'AppShell'

export default { AppShell }
