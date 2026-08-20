import { Icon } from '@FluxUI/Icon';
import {
  DiceFaces05Icon,
  Book02Icon,
  FavouriteIcon,
  FilmRoll01Icon,
  FireIcon,
  Home01Icon,
  Cancel01Icon,
  Notification01Icon,
  Search01Icon,
  Settings01Icon,
  Tv01Icon,
  UserCircleIcon,
} from '@hugeicons/core-free-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ActionMenu } from '@FluxUI/ActionMenu';
import { Button } from '@FluxUI/Button';
import { NavDock } from '@FluxUI/NavDock';
import { MoodBackground } from '@FluxUI/MoodBackground';
import { useDotFilm } from '@FluxUI/useDotFilm';
import { useKonamiCode } from '@FluxUI/useKonamiCode';
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal';
import { BROWSE_SECTIONS } from './AppShell.types';
import type { ReactNode } from 'react';
import type { IconGesture } from '@FluxUI/AnimatedIcon.types';
import type { NavDockAction, NavDockItem } from '@FluxUI/NavDock.types';
import type { LibraryKind } from '@FluxContracts/schemas/Library';
import type { AppShellProps, ShellSection } from './AppShell.types';

const FADING = 1.2;

const SURPRISE_LABELS: Record<LibraryKind, string> = {
  movies: 'A film',
  shows: 'A programme',
  music: 'Something to listen to',
  books: 'Something to read',
};

const SECTION_ICONS: Record<ShellSection, ReactNode> = {
  home: <Icon of={Home01Icon} size={18} />,
  shows: <Icon of={Tv01Icon} size={18} />,
  films: <Icon of={FilmRoll01Icon} size={18} />,
  new: <Icon of={FireIcon} size={18} />,
  favourites: <Icon of={FavouriteIcon} size={18} />,
  read: <Icon of={Book02Icon} size={18} />,
  search: <Icon of={Search01Icon} size={18} />,
  account: <Icon of={UserCircleIcon} size={18} />,
  admin: <Icon of={Settings01Icon} size={18} />,
};

const ACTIVE_SECTION_ICONS: Record<ShellSection, ReactNode> = {
  home: <Icon of={Home01Icon} size={18} isActive />,
  shows: <Icon of={Tv01Icon} size={18} isActive />,
  films: <Icon of={FilmRoll01Icon} size={18} isActive />,
  new: <Icon of={FireIcon} size={18} isActive />,
  favourites: <Icon of={FavouriteIcon} size={18} isActive />,
  read: <Icon of={Book02Icon} size={18} isActive />,
  search: <Icon of={Search01Icon} size={18} isActive />,
  account: <Icon of={UserCircleIcon} size={18} isActive />,
  admin: <Icon of={Settings01Icon} size={18} isActive />,
};

const SECTION_GESTURES: Record<ShellSection, IconGesture> = {
  home: 'settle',
  shows: 'settle',
  films: 'settle',
  new: 'fill',
  favourites: 'fill',
  read: 'settle',
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
  read: 'Read',
  search: 'Search',
  account: 'Account',
  admin: 'Admin',
};

/**
 * The frame every page is drawn inside: the dock at the foot, the light behind, and the footer at
 * the end of the scroll. Sections arrive rather than appear, and each remembers how far down it was
 * scrolled so moving between them and back lands where it was left.
 *
 * @param section - Which section is showing.
 * @param onSectionChange - Told which section was chosen.
 * @param children - The page itself.
 * @param moodLights - The colours to light the page with.
 * @param isAdministrator - Whether to offer the admin section at all.
 * @param avatar - The face to draw on the account control.
 * @param onSurprise - Told to choose something at random, optionally from one kind of library.
 * @param surpriseKinds - Which kinds of library there are, which decides whether the dice offer a
 *   menu or simply act.
 * @param notifications - The bell and what is behind it.
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
  const [isFilmPlaying, setIsFilmPlaying] = useState(false);

  useKonamiCode(() => {
    if (section === 'home' && prefersReducedMotion !== true) {
      setIsFilmPlaying(true);
    }
  });

  const endFilm = useCallback(() => {
    setIsFilmPlaying(false);
  }, []);

  const film = useDotFilm(isFilmPlaying, endFilm);

  useEffect(() => {
    setIsFilmPlaying(false);
  }, [section]);

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
      icon: <Icon of={Search01Icon} size={20} />,
      activeIcon: <Icon of={Search01Icon} size={20} />,
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
            icon: <Icon of={DiceFaces05Icon} size={20} />,
            gesture: 'tumble' as const,
            ...(surpriseKinds.length > 1
              ? {
                  control: (
                    <ActionMenu
                      label="Choose something at random"
                      align="center"
                      className="hover:bg-transparent data-[popup-open]:bg-transparent"
                      trigger={<Icon of={DiceFaces05Icon} size={20} />}
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
            icon: <Icon of={Notification01Icon} size={20} />,
            gesture: 'ring' as const,
            control: notifications,
          },
        ]),
    ...(isAdministrator
      ? [
          {
            id: 'admin',
            label: 'Admin',
            icon: <Icon of={Settings01Icon} size={20} />,
            activeIcon: <Icon of={Settings01Icon} size={20} />,
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
      icon: avatar ?? <Icon of={UserCircleIcon} size={22} />,
      activeIcon: avatar ?? <Icon of={UserCircleIcon} size={20} />,
      gesture: 'settle' as const,
      isCurrent: section === 'account',
      onSelect: () => {
        onSectionChange('account');
      },
    },
  ];

  return (
    <div className="flux-docked relative min-h-screen text-text">
      <MoodBackground lights={moodLights} hasGrid={section === 'home'} film={film} />

      <AnimatePresence>
        {isFilmPlaying ? (
          <motion.div
            key="leave-film"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: prefersReducedMotion === true ? 0 : FADING,
              ease: 'easeInOut',
            }}
            className="fixed top-4 right-4 z-50"
          >
            <Button isIconOnly variant="overlay" label="Stop the film" onClick={endFilm}>
              <Icon of={Cancel01Icon} size={20} />
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        animate={{ opacity: isFilmPlaying ? 0 : 1 }}
        transition={{ duration: prefersReducedMotion === true ? 0 : FADING, ease: 'easeInOut' }}
        className={isFilmPlaying ? 'pointer-events-none' : undefined}
      >
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
      </motion.div>
    </div>
  );
};

AppShell.displayName = 'AppShell';

export { AppShell };
