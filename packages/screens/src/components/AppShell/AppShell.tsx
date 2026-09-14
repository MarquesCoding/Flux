import { Icon } from '@ValenceUI/Icon';
import {
  BookOpen01Icon,
  Cancel01Icon,
  ComputerIcon,
  DiceFaces05Icon,
  Download04Icon,
  FavouriteIcon,
  Film01Icon,
  FireIcon,
  Home01Icon,
  Logout01Icon,
  Moon02Icon,
  Notification01Icon,
  Search01Icon,
  Settings02Icon,
  Sun01Icon,
  Tv01Icon,
  UserCircleIcon,
} from '@hugeicons/core-free-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotionConfig,
  useScroll,
} from 'motion/react';
import { ActionMenu } from '@ValenceUI/ActionMenu';
import { Button } from '@ValenceUI/Button';
import { NavBar } from '@ValenceUI/NavBar';
import { Logo } from '@ValenceUI/Logo';
import { MoodBackground } from '@ValenceUI/MoodBackground';
import { useDotFilm } from '@ValenceUI/useDotFilm';
import { useKonamiCode } from '@ValenceUI/useKonamiCode';
import {
  revealVariants,
  revealTransition,
  staggerVariants,
  liquidSpring,
  stillTransition,
} from '@ValenceUI/animations/reveal';
import { canKeepFiles } from '@ValenceClient/downloads/canKeepFiles';
import { useTheme } from '@ValenceClient/shell/useTheme';
import { THEME_CHOICES } from '@ValenceScreens/theme/themeChoices';
import { BROWSE_SECTIONS } from './AppShell.types';
import type { ReactNode } from 'react';
import type { IconGesture } from '@ValenceUI/AnimatedIcon.types';
import type { NavBarAction, NavBarItem } from '@ValenceUI/NavBar.types';
import type { LibraryKind } from '@ValenceContracts/schemas/Library';
import type { Theme } from '@ValenceClient/shell/theme';
import type { AppShellProps, ShellSection } from './AppShell.types';

const FADING = 1.2;

const SOLID_WITHIN = 64;

const SHEET_SOLID_BY = 0.5;

const MARKS_PLACE = 'valence-mark';

/**
 * How far the bar should be painted in, given how far the page has scrolled.
 *
 * Solid by the time the page's content reaches the bar, and not before — so on a page that opens on
 * a hero, which is a long scroll before anything passes underneath, the bar arrives gradually over
 * all of it. Where the content begins is read from the element that says it meets the bar; a page
 * without one begins its content just below the bar, and fills over the first few pixels instead.
 *
 * The same answer is put on the shell as `--content-reach`, so the sheet the rows ride up on can fade
 * in by it too — clear over the hero at the top of the page, solid by the time it reaches the bar.
 *
 * @param travelled - How far the page has scrolled.
 * @returns How solid, from nothing to one.
 */
const howSolid = (travelled: number): number => {
  const meets = document.querySelector<HTMLElement>('[data-meets-bar]');
  const bar = document.querySelector<HTMLElement>('.valence-navbar')?.offsetHeight ?? SOLID_WITHIN;

  const reach =
    meets === null
      ? SOLID_WITHIN
      : Math.max(meets.getBoundingClientRect().top + travelled - bar, SOLID_WITHIN);

  return Math.min(Math.max(travelled / reach, 0), 1);
};

const THEME_ICONS: Record<Theme, ReactNode> = {
  system: <Icon of={ComputerIcon} size={16} />,
  light: <Icon of={Sun01Icon} size={16} />,
  dark: <Icon of={Moon02Icon} size={16} />,
};

const STOCKED_ONLY: ReadonlySet<ShellSection> = new Set(['shows', 'films', 'read']);

const SURPRISE_LABELS: Record<LibraryKind, string> = {
  movies: 'A film',
  shows: 'A programme',
  music: 'Something to listen to',
  books: 'Something to read',
};

const SECTION_ICONS: Record<ShellSection, ReactNode> = {
  home: <Icon of={Home01Icon} size={18} />,
  shows: <Icon of={Tv01Icon} size={18} />,
  films: <Icon of={Film01Icon} size={18} />,
  new: <Icon of={FireIcon} size={18} />,
  favourites: <Icon of={FavouriteIcon} size={18} />,
  read: <Icon of={BookOpen01Icon} size={18} />,
  search: <Icon of={Search01Icon} size={18} />,
  account: <Icon of={UserCircleIcon} size={18} />,
  admin: <Icon of={Settings02Icon} size={18} />,
};

const ACTIVE_SECTION_ICONS: Record<ShellSection, ReactNode> = {
  home: <Icon of={Home01Icon} size={18} isActive />,
  shows: <Icon of={Tv01Icon} size={18} isActive />,
  films: <Icon of={Film01Icon} size={18} isActive />,
  new: <Icon of={FireIcon} size={18} isActive />,
  favourites: <Icon of={FavouriteIcon} size={18} isActive />,
  read: <Icon of={BookOpen01Icon} size={18} isActive />,
  search: <Icon of={Search01Icon} size={18} isActive />,
  account: <Icon of={UserCircleIcon} size={18} isActive />,
  admin: <Icon of={Settings02Icon} size={18} isActive />,
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
  read: 'Books',
  search: 'Search',
  account: 'Account',
  admin: 'Admin',
};

/**
 * The frame every page is drawn inside: the bar along the top, the light behind, and the footer at
 * the end of the scroll. The bar is clear until the page has been scrolled and painted in after, so
 * the top of a page is the page rather than chrome laid over it. Sections arrive rather than appear, and each remembers how far down it was
 * scrolled so moving between them and back lands where it was left.
 *
 * @param section - Which section is showing.
 * @param onSectionChange - Told which section was chosen.
 * @param children - The page itself.
 * @param moodLights - The colours to light the page with.
 * @param isAdministrator - Whether to offer the admin section at all.
 * @param isDownloadsOpen - Whether the downloads dialog is raised.
 * @param onOpenDownloads - Told to raise the downloads dialog.
 * @param isAdminOpen - Whether the server dialog is raised, which lights the bar's face, since the
 *   account menu is where it is opened from.
 * @param onOpenAdmin - Told to raise the server dialog, from the account menu.
 * @param isAccountOpen - Whether the account dialog is raised, which lights the bar's face.
 * @param onOpenAccount - Told to raise the account dialog.
 * @param avatar - The face to draw on the account control.
 * @param onSignOut - Told to end the session.
 * @param onSurprise - Told to choose something at random, optionally from one kind of library.
 * @param libraryKinds - Which kinds of library there are, which decides whether the dice offer a
 *   menu or simply act.
 * @param stocked - Which of films, programmes and books have anything in them, once known. A place
 *   in the bar is offered only where there is something to find there — an empty library is not a
 *   place to go — and every place is offered until the answer arrives, rather than places
 *   appearing one by one as it does.
 * @param notifications - The bell and what is behind it.
 * @param hasMark - Whether the bar draws the mark itself. It does not while a screen held over the
 *   page is still showing it: the mark is one thing moving from there to here, and two of them on
 *   screen at once is two marks rather than one arriving.
 */
const AppShell = ({
  section,
  onSectionChange,
  children,
  hasMark = true,
  moodLights = [],
  isAdministrator = false,
  isAccountOpen,
  onOpenAccount,
  isAdminOpen,
  onOpenAdmin,
  isDownloadsOpen,
  onOpenDownloads,
  avatar,
  onSignOut,
  onSurprise,
  libraryKinds,
  stocked,
  notifications,
}: AppShellProps) => {
  const prefersReducedMotion = useReducedMotionConfig();
  const [isFilmPlaying, setIsFilmPlaying] = useState(false);
  const { scrollY } = useScroll();
  const solidity = useMotionValue(0);
  const { theme, choose } = useTheme();

  const shellRef = useRef<HTMLDivElement>(null);

  const reach = useCallback(
    (travelled: number) => {
      const reached = howSolid(travelled);
      const covered = Math.min(reached / SHEET_SOLID_BY, 1);

      solidity.set(reached);
      shellRef.current?.style.setProperty('--content-reach', covered.toString());
    },
    [solidity],
  );

  useMotionValueEvent(scrollY, 'change', reach);

  useEffect(() => {
    reach(window.scrollY);
  }, [reach, section]);

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

  const kinds = libraryKinds ?? [];

  const places = BROWSE_SECTIONS.filter(
    (id) => stocked === undefined || !STOCKED_ONLY.has(id) || stocked.includes(id),
  );

  const items: NavBarItem[] = places.map((id) => ({
    id,
    label: SECTION_LABELS[id],
    icon: SECTION_ICONS[id],
    activeIcon: ACTIVE_SECTION_ICONS[id],
    gesture: SECTION_GESTURES[id],
  }));

  const face = avatar ?? <Icon of={UserCircleIcon} size={22} />;

  const actions: NavBarAction[] = [
    ...(canKeepFiles()
      ? [
          {
            id: 'downloads',
            label: 'Downloads',
            icon: <Icon of={Download04Icon} size={20} />,
            activeIcon: <Icon of={Download04Icon} size={20} isActive />,
            gesture: 'settle' as const,
            isCurrent: isDownloadsOpen,
            onSelect: onOpenDownloads,
          },
        ]
      : []),
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
            ...(kinds.length > 1
              ? {
                  control: (
                    <ActionMenu
                      label="Choose something at random"
                      align="center"
                      className="rounded-full hover:bg-transparent"
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
                            ...kinds.map((kind) => ({
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
            control: notifications,
          },
        ]),
    {
      id: 'account',
      label: 'Account',
      icon: face,
      gesture: avatar === undefined ? ('settle' as const) : ('none' as const),
      isCurrent: isAccountOpen || isAdminOpen,
      control: (
        <ActionMenu
          label="Account"
          align="end"
          className="rounded-full hover:bg-transparent"
          trigger={face}
          groups={[
            {
              items: [
                {
                  id: 'account',
                  label: 'Account',
                  icon: <Icon of={UserCircleIcon} size={16} />,
                  onChoose: onOpenAccount,
                },
                ...(isAdministrator
                  ? [
                      {
                        id: 'admin',
                        label: 'Admin',
                        icon: <Icon of={Settings02Icon} size={16} />,
                        onChoose: onOpenAdmin,
                      },
                    ]
                  : []),
              ],
            },
            {
              name: 'Theme',
              items: THEME_CHOICES.map((choice) => ({
                id: `theme-${choice.id}`,
                label: choice.label,
                icon: THEME_ICONS[choice.id],
                keepsOpen: true,
                ...(theme === choice.id ? { detail: '✓' } : {}),
                onChoose: () => {
                  choose(choice.id);
                },
              })),
            },
            ...(onSignOut === undefined
              ? []
              : [
                  {
                    items: [
                      {
                        id: 'sign-out',
                        label: 'Sign out',
                        icon: <Icon of={Logout01Icon} size={16} />,
                        onChoose: onSignOut,
                      },
                    ],
                  },
                ]),
          ]}
        />
      ),
    },
  ];

  return (
    <div
      ref={shellRef}
      className="valence-shell relative min-h-[calc(100vh-var(--valence-window-bar))] text-text"
    >
      <MoodBackground lights={moodLights} film={film} />

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
            className="fixed top-[calc(1rem+var(--nav-clearance))] right-4 z-50"
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
        <NavBar
          brand={
            <Button
              variant="bare"
              size="none"
              label="Valence, back to the start"
              hasTooltip={false}
              onClick={() => {
                onSectionChange('home');
              }}
              className="flex items-center rounded-md"
            >
              {hasMark ? (
                <motion.span
                  layoutId={MARKS_PLACE}
                  transition={{
                    layout: prefersReducedMotion === true ? stillTransition : liquidSpring,
                  }}
                  className="flex items-center"
                >
                  <Logo size={28} isSolid />
                </motion.span>
              ) : (
                <span aria-hidden className="flex items-center opacity-0">
                  <Logo size={28} isSolid />
                </span>
              )}
            </Button>
          }
          solidity={solidity}
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
          className="min-h-[calc(100vh-var(--valence-window-bar))] pb-16 pt-[var(--nav-clearance)]"
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
