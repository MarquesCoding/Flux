import { useEffect, useRef } from 'react';
import {
  IconClock,
  IconDice5,
  IconHeart,
  IconHome,
  IconMovie,
  IconSearch,
  IconSettings,
  IconTrendingUp,
  IconUserCircle,
} from '@tabler/icons-react';
import { motion, useReducedMotion } from 'motion/react';
import { TopNav } from '@FluxUI/TopNav';
import { MoodBackground } from '@FluxUI/MoodBackground';
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal';
import { NotificationBell } from './components/NotificationBell/NotificationBell';
import { BROWSE_SECTIONS } from './AppShell.types';
import type { ReactNode } from 'react';
import type { TopNavAction, TopNavItem } from '@FluxUI/TopNav.types';
import type { AppShellProps, ShellSection } from './AppShell.types';

/**
 * The mark each place carries while it is the one being stood on.
 */
const SECTION_ICONS: Record<ShellSection, ReactNode> = {
  home: <IconHome size={18} aria-hidden />,
  shows: <IconClock size={18} aria-hidden />,
  films: <IconMovie size={18} aria-hidden />,
  new: <IconTrendingUp size={18} aria-hidden />,
  favourites: <IconHeart size={18} aria-hidden />,
  search: <IconSearch size={18} aria-hidden />,
  account: <IconUserCircle size={18} aria-hidden />,
  admin: <IconSettings size={18} aria-hidden />,
};

const SECTION_LABELS: Record<ShellSection, string> = {
  home: 'Home',
  shows: 'Shows',
  films: 'Films',
  new: 'New & Popular',
  favourites: 'Favourites',
  search: 'Search',
  account: 'Account',
  admin: 'Admin',
};

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
  onSurprise,
}: AppShellProps) => {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (section === 'home') {
      return;
    }

    // Escape is what everyone tries to get out of a place they have wandered
    // into. Home is where it lets them out.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onSectionChange('home');
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [section, onSectionChange]);

  // Each section keeps its own place. Arriving at search from halfway down the
  // library and landing halfway down the results is a page that has kept
  // somebody else's place — but coming back to the library after a look at an
  // account page and being thrown to the top is a page that has forgotten
  // yours. So the offset is remembered per section and given back.
  const placesRef = useRef<Record<string, number>>({});
  const leavingRef = useRef(section);

  useEffect(() => {
    const left = leavingRef.current;

    if (left !== section) {
      placesRef.current[left] = window.scrollY;
      leavingRef.current = section;
    }

    // After the page has been drawn, not before: restoring a place on a page
    // that is still a screen tall scrolls to the bottom of nothing.
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: placesRef.current[section] ?? 0 });
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [section]);

  const items: TopNavItem[] = BROWSE_SECTIONS.map((id) => ({
    id,
    label: SECTION_LABELS[id],
    icon: SECTION_ICONS[id],
  }));

  const actions: TopNavAction[] = [
    {
      id: 'search',
      label: 'Search',
      icon: <IconSearch size={20} aria-hidden />,
      isCurrent: section === 'search',
      onSelect: () => {
        onSectionChange('search');
      },
    },
    ...(onSurprise === undefined
      ? []
      : [
          {
            id: 'surprise',
            label: 'Watch something at random',
            icon: <IconDice5 size={20} aria-hidden />,
            onSelect: onSurprise,
          },
        ]),
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
              onSectionChange('admin');
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
        onSectionChange('account');
      },
    },
  ];

  return (
    <div className="relative min-h-screen text-text">
      {/* The grid belongs where a page is mostly its own background: the way
          in, and home behind the hero. A page of results or a form is already
          full of things, and a texture under them is noise. */}
      <MoodBackground lights={moodLights} hasGrid={section === 'home'} />

      <TopNav
        items={items}
        selectedId={section}
        actions={actions}
        onSelect={(id) => {
          const chosen = BROWSE_SECTIONS.find((candidate) => candidate === id);

          if (chosen !== undefined) {
            onSectionChange(chosen);
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
  );
};

AppShell.displayName = 'AppShell';

export { AppShell };
