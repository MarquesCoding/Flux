import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  IconDeviceTv,
  IconHome,
  IconMovie,
  IconSettings,
  IconUserCircle,
} from '@tabler/icons-react'
import SideNavModule from '@FluxUI/SideNav'
import MoodBackgroundModule from '@FluxUI/MoodBackground'
import readSidebarStateModule from '@FluxWeb/shell/readSidebarState'
import TopBarModule from './components/TopBar/TopBar'
import type { SideNavItem } from '@FluxUI/SideNav.types'
import type { AppShellProps, ShellSection } from './AppShell.types'

const { SideNav } = SideNavModule
const { MoodBackground } = MoodBackgroundModule
const { TopBar } = TopBarModule
const { readSidebarState, saveSidebarState } = readSidebarStateModule

/**
 * How far the content scrolls before the bar needs something to sit on.
 */
const LIFT_AFTER_PIXELS = 24

const SECTION_ICONS: Record<ShellSection, ReactNode> = {
  home: <IconHome size={20} aria-hidden />,
  films: <IconMovie size={20} aria-hidden />,
  series: <IconDeviceTv size={20} aria-hidden />,
  account: <IconUserCircle size={20} aria-hidden />,
  admin: <IconSettings size={20} aria-hidden />,
}

const SECTION_LABELS: Record<ShellSection, string> = {
  home: 'Home',
  films: 'Films',
  series: 'Series',
  account: 'Account',
  admin: 'Admin',
}

/**
 * The frame everything is drawn inside.
 *
 * A rail down the side, a bar across the top and the page between them, over a
 * wash of colour taken from whatever is being shown. The shell owns none of
 * the content: what it holds is the caller's, which is what lets the same
 * frame carry a library, an account page and an administration area without
 * knowing anything about any of them.
 */
const AppShell = ({
  section,
  onSectionChange,
  search,
  onSearchChange,
  account,
  children,
  moodColor,
  isAdministrator = false,
  brandName = 'Flux',
}: AppShellProps) => {
  const [isExpanded, setIsExpanded] = useState(readSidebarState)
  const [isLifted, setIsLifted] = useState(false)
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    saveSidebarState(isExpanded)
  }, [isExpanded])

  const sections: ShellSection[] = isAdministrator
    ? ['home', 'films', 'series', 'account', 'admin']
    : ['home', 'films', 'series', 'account']

  const items: SideNavItem[] = sections.map((id) => ({
    id,
    label: SECTION_LABELS[id],
    icon: SECTION_ICONS[id],
  }))

  return (
    <div className="flex h-screen overflow-hidden text-text">
      <MoodBackground color={moodColor ?? null} />

      <SideNav
        items={items}
        selectedId={section}
        isExpanded={isExpanded}
        onSelect={(id) => {
          const chosen = sections.find((candidate) => candidate === id)

          if (chosen !== undefined) {
            onSectionChange(chosen)
          }
        }}
        onToggle={() => {
          setIsExpanded((expanded) => !expanded)
        }}
        brand={<span className="text-lg font-semibold tracking-tight">{brandName}</span>}
        className="shrink-0"
      />

      <div
        ref={scrollerRef}
        onScroll={(event) => {
          setIsLifted(event.currentTarget.scrollTop > LIFT_AFTER_PIXELS)
        }}
        className="flex-1 overflow-y-auto"
      >
        <TopBar
          search={search}
          onSearchChange={onSearchChange}
          account={account}
          isLifted={isLifted}
        />

        <main className="min-h-full pb-16">{children}</main>
      </div>
    </div>
  )
}

AppShell.displayName = 'AppShell'

export default { AppShell }
