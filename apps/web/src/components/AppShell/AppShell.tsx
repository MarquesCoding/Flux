import { useEffect, useRef } from 'react';
import {
  RiAccountCircleFill,
  RiAccountCircleLine,
  RiDice5Line,
  RiFilmFill,
  RiFilmLine,
  RiHeartFill,
  RiHeartLine,
  RiHome5Fill,
  RiHome5Line,
  RiFireFill,
  RiFireLine,
  RiNotification3Line,
  RiSearchFill,
  RiSearchLine,
  RiSettings3Fill,
  RiSettings3Line,
  RiTvFill,
  RiTvLine,
} from '@remixicon/react';
import { motion, useReducedMotion } from 'motion/react';
import { ActionMenu } from '@FluxUI/ActionMenu';
import { NavDock } from '@FluxUI/NavDock';
import { MoodBackground } from '@FluxUI/MoodBackground';
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal';
import { BROWSE_SECTIONS } from './AppShell.types';
import type { ReactNode } from 'react';
import type { IconGesture } from '@FluxUI/AnimatedIcon.types';
import type { NavDockAction, NavDockItem } from '@FluxUI/NavDock.types';
import type { LibraryKind } from '@FluxContracts/schemas/Library';
import type { AppShellProps, ShellSection } from './AppShell.types';

const SURPRISE_LABELS: Record<LibraryKind, string> = {
  movies: 'A film',
  shows: 'A programme',
  music: 'Something to listen to',
};

const SECTION_ICONS: Record<ShellSection, ReactNode> = {
  home: <RiHome5Line size={18} aria-hidden />,
  shows: <RiTvLine size={18} aria-hidden />,
  films: <RiFilmLine size={18} aria-hidden />,
  new: <RiFireLine size={18} aria-hidden />,
  favourites: <RiHeartLine size={18} aria-hidden />,
  search: <RiSearchLine size={18} aria-hidden />,
  account: <RiAccountCircleLine size={18} aria-hidden />,
  admin: <RiSettings3Line size={18} aria-hidden />,
};

const ACTIVE_SECTION_ICONS: Record<ShellSection, ReactNode> = {
  home: <RiHome5Fill size={18} aria-hidden />,
  shows: <RiTvFill size={18} aria-hidden />,
  films: <RiFilmFill size={18} aria-hidden />,
  new: <RiFireFill size={18} aria-hidden />,
  favourites: <RiHeartFill size={18} aria-hidden />,
  search: <RiSearchFill size={18} aria-hidden />,
  account: <RiAccountCircleFill size={18} aria-hidden />,
  admin: <RiSettings3Fill size={18} aria-hidden />,
};

const SECTION_GESTURES: Record<ShellSection, IconGesture> = {
  home: 'settle',
  shows: 'settle',
  films: 'settle',
  new: 'fill',
  favourites: 'fill',
  search: 'settle',
  account: 'settle',
  admin: 'spin',
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
  notifications,
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
    gesture: SECTION_GESTURES[id],
  }));

  const actions: NavDockAction[] = [
    {
      id: 'search',
      label: 'Search',
      icon: <RiSearchLine size={20} aria-hidden />,
      activeIcon: <RiSearchFill size={20} aria-hidden />,
      gesture: 'settle' as const,
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
            icon: <RiDice5Line size={20} aria-hidden />,
            gesture: 'tumble' as const,
            ...(surpriseKinds.length > 1
              ? {
                  control: (
                    <ActionMenu
                      label="Choose something at random"
                      align="center"
                      className="hover:bg-transparent data-[popup-open]:bg-transparent"
                      trigger={<RiDice5Line size={20} aria-hidden />}
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
    ...(notifications === undefined
      ? []
      : [
          {
            id: 'notifications',
            label: 'Notifications',
            icon: <RiNotification3Line size={20} aria-hidden />,
            gesture: 'ring' as const,
            control: notifications,
          },
        ]),
    ...(isAdministrator
      ? [
          {
            id: 'admin',
            label: 'Admin',
            icon: <RiSettings3Line size={20} aria-hidden />,
            activeIcon: <RiSettings3Fill size={20} aria-hidden />,
            gesture: 'spin' as const,
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
      icon: avatar ?? <RiAccountCircleLine size={22} aria-hidden />,
      activeIcon: avatar ?? <RiAccountCircleFill size={20} aria-hidden />,
      gesture: 'settle' as const,
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
