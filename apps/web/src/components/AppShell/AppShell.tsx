import { useEffect, useRef } from 'react';
import {
  IconDeviceTv,
  IconDeviceTvFilled,
  IconDice5,
  IconHeart,
  IconHeartFilled,
  IconHome,
  IconHomeFilled,
  IconMovie,
  IconSearch,
  IconSearchFilled,
  IconSettings,
  IconSettingsFilled,
  IconTrendingUp,
  IconUserCircle,
  IconUserFilled,
} from '@tabler/icons-react';
import { motion, useReducedMotion } from 'motion/react';
import { ActionMenu } from '@FluxUI/ActionMenu';
import { NavDock } from '@FluxUI/NavDock';
import { MoodBackground } from '@FluxUI/MoodBackground';
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal';
import { BROWSE_SECTIONS } from './AppShell.types';
import type { ReactNode } from 'react';
import type { NavDockAction, NavDockItem } from '@FluxUI/NavDock.types';
import type { LibraryKind } from '@FluxContracts/schemas/Library';
import type { AppShellProps, ShellSection } from './AppShell.types';

/**
 * What each kind of library is called when the dice offer to narrow to it.
 *
 * Written as a complete record rather than derived, so adding a kind to the
 * contract fails to compile here until somebody says what to call it. A new
 * kind appearing in the menu unnamed would be worse than being made to name
 * it.
 */
const SURPRISE_LABELS: Record<LibraryKind, string> = {
  movies: 'A film',
  shows: 'A programme',
  music: 'Something to listen to',
};

/**
 * The mark each place carries while it is the one being stood on.
 */
const SECTION_ICONS: Record<ShellSection, ReactNode> = {
  home: <IconHome size={18} aria-hidden />,
  shows: <IconDeviceTv size={18} aria-hidden />,
  films: <IconMovie size={18} aria-hidden />,
  new: <IconTrendingUp size={18} aria-hidden />,
  favourites: <IconHeart size={18} aria-hidden />,
  search: <IconSearch size={18} aria-hidden />,
  account: <IconUserCircle size={18} aria-hidden />,
  admin: <IconSettings size={18} aria-hidden />,
};

/**
 * The same mark, heavier, for the place being stood on.
 *
 * Never a different glyph: arriving somewhere changes the weight of a shape
 * that was already there rather than swapping it for another drawing.
 *
 * Filled where Tabler draws a filled twin, and a thicker stroke where it does
 * not. `movie` and `trending-up` have none, and reaching for the nearest
 * filled thing instead is how this section came to turn into a camcorder.
 */
const ACTIVE_SECTION_ICONS: Record<ShellSection, ReactNode> = {
  home: <IconHomeFilled size={18} aria-hidden />,
  shows: <IconDeviceTvFilled size={18} aria-hidden />,
  films: <IconMovie size={18} stroke={3} aria-hidden />,
  new: <IconTrendingUp size={18} stroke={3} aria-hidden />,
  favourites: <IconHeartFilled size={18} aria-hidden />,
  search: <IconSearchFilled size={18} aria-hidden />,
  account: <IconUserFilled size={18} aria-hidden />,
  admin: <IconSettingsFilled size={18} aria-hidden />,
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
 * One dock, floating at the bottom, sectioned: the places in the middle, the
 * tools at the right. Two bars — one for places, one for tools — meant every
 * arrival had to be read twice to find out where anything was. The library
 * gets the whole surface behind it, which is what the dock floats over.
 *
 * The footer sits at the end of the scroll on every page but the admin one,
 * which is a dashboard somebody works in rather than a page they read to the
 * bottom of. It carries its own room for the dock; the admin page is given
 * that room instead.
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
  surpriseKinds = [],
}: AppShellProps) => {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (section === 'home') {
      return;
    }

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

  const placesRef = useRef<Record<string, number>>({});
  const leavingRef = useRef(section);

  useEffect(() => {
    const left = leavingRef.current;

    if (left !== section) {
      placesRef.current[left] = window.scrollY;
      leavingRef.current = section;
    }

    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: placesRef.current[section] ?? 0 });
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [section]);

  const items: NavDockItem[] = BROWSE_SECTIONS.map((id) => ({
    id,
    label: SECTION_LABELS[id],
    icon: SECTION_ICONS[id],
    activeIcon: ACTIVE_SECTION_ICONS[id],
  }));

  const actions: NavDockAction[] = [
    {
      id: 'search',
      label: 'Search',
      icon: <IconSearch size={20} aria-hidden />,
      activeIcon: <IconSearchFilled size={20} aria-hidden />,
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
            label: 'Randomiser',
            icon: <IconDice5 size={20} aria-hidden />,
            ...(surpriseKinds.length > 1
              ? {
                  control: (
                    <ActionMenu
                      label="Choose something at random"
                      trigger={<IconDice5 size={20} aria-hidden />}
                      groups={[
                        {
                          items: [
                            {
                              id: 'anything',
                              label: 'Anything',
                              onChoose: () => {
                                onSurprise();
                              },
                            },
                            ...surpriseKinds.map((kind) => ({
                              id: kind,
                              label: SURPRISE_LABELS[kind],
                              onChoose: () => {
                                onSurprise(kind);
                              },
                            })),
                          ],
                        },
                      ]}
                    />
                  ),
                }
              : {
                  onSelect: () => {
                    onSurprise();
                  },
                }),
          },
        ]),
    ...(isAdministrator
      ? [
          {
            id: 'admin',
            label: 'Admin',
            icon: <IconSettings size={20} aria-hidden />,
            activeIcon: <IconSettingsFilled size={20} aria-hidden />,
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
      activeIcon: avatar ?? <IconUserFilled size={20} aria-hidden />,
      isCurrent: section === 'account',
      onSelect: () => {
        onSectionChange('account');
      },
    },
  ];

  return (
    <div className="relative min-h-screen text-text">
      <MoodBackground lights={moodLights} hasGrid={section === 'home'} />

      <NavDock
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
        key={section}
        variants={staggerVariants}
        initial="hidden"
        animate="shown"
        className="min-h-screen pb-28"
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
