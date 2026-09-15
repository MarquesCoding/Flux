import { useState } from 'react';
import { motion } from 'motion/react';
import { Menu01Icon } from '@hugeicons/core-free-icons';
import { ActionMenu } from '@ValenceUI/ActionMenu';
import { AnimatedIcon } from '@ValenceUI/AnimatedIcon';
import { Button } from '@ValenceUI/Button';
import { Icon } from '@ValenceUI/Icon';
import { SlidingMark } from '@ValenceUI/SlidingMark';
import { cn } from '@ValenceUI/cn';
import { useOpenAction } from './useOpenAction';
import type { NavBarProps } from './NavBar.types';

const MOVES = 'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-soft)]';

const OPENS = [
  'transition-[width,margin,opacity] duration-[var(--duration-base)] ease-[var(--ease-soft)]',
  'motion-reduce:transition-none',
].join(' ');

/**
 * The platform's one navigation bar, along the top of the window: the mark, the places, and the
 * tools at the right, which do something rather than going somewhere.
 *
 * Clear while the page is at its top, so the first thing somebody sees is the page rather than
 * chrome laid over it, and painted in as they scroll, so whatever passes beneath does not run
 * through the words. How far painted in it is belongs to the page, since only the page knows how
 * far it has been scrolled and where its content begins.
 *
 * It follows the scroll rather than switching at a point in it. A switch is all or nothing however
 * softly it eases, and on a page with a hero there is a long stretch of scroll before anything
 * reaches the bar — room for it to arrive gradually, and a snap to solid a few pixels in wastes it.
 *
 * The paint is a layer of its own, so that one opacity carries the colour, the blur and the edge
 * together: a blur behind glass cannot be eased on its own, and would jump while the colour faded.
 *
 * A single mark rests on where you are, follows the pointer to whatever it passes over, and returns
 * when the pointer leaves. Places are words wherever there is room for them and their icons where
 * there is not — and the place being stood on carries its icon beside its word as well, so where you
 * are is said twice rather than only by the mark behind it. That icon holds still under the pointer:
 * it sits beside a word rather than standing in for one, and a lift or a wipe there reads as the
 * word jumping; the tools are always icons, named on hover.
 *
 * On a narrow screen the places fold into a menu behind one mark, because the row of them there is
 * icons with their words suppressed — a line of glyphs to be guessed at rather than read. A menu
 * gives each one its word back and says which is being stood on. The tools stay out on the bar
 * beside it: searching and the rest are done from wherever you are, and burying them a tap deeper
 * to tidy the bar would cost more than the tidying is worth.
 *
 * An action whose control has a panel open is held still while it is open, because a popover is
 * anchored to the icon that opened it and a gesture played underneath it would shove the panel.
 *
 * A place that was just pressed is lit from the press itself rather than from the address, because
 * the address arrives a commit later: reading the mark from it alone sent the mark back to the place
 * you had left and then forward again, which is the one movement a travelling mark must never make.
 *
 * Focus moving from one place to the next is not focus leaving the bar. A blur is raised by the
 * control being left and rises through the bar, so treating any of them as the pointer leaving
 * dropped the highlight in the middle of a press — the same flick back, by a second route.
 *
 * Something the pointer is on is lit, and so is something keyboard focus has reached — but not
 * something focus was merely handed back to. Closing a dialog returns focus to the control that
 * opened it, and lighting on any focus left that control marked as the place you were long after
 * the dialog had gone.
 *
 * @param brand - The mark at the left of the bar.
 * @param items - The places, in the order they are shown.
 * @param selectedId - Which place is being stood on.
 * @param onSelect - Told which place was chosen.
 * @param actions - The tools at the right.
 * @param solidity - How far painted in it is, from clear at nothing to solid at one. Solid where
 *   the page does not say, since a bar that cannot be read over content is worse than one that is
 *   never clear.
 * @param className - Extra classes for the caller's own layout.
 */
const NavBar = ({
  brand,
  items,
  selectedId,
  onSelect,
  actions = [],
  solidity = 1,
  className,
}: NavBarProps) => {
  const [pointedAt, setPointedAt] = useState<string | null>(null);
  const { actionsRef, openAction } = useOpenAction();

  const lit = pointedAt ?? selectedId;

  const mark = <SlidingMark group="nav-bar-mark" />;

  return (
    <header className={cn('valence-navbar fixed inset-x-0 top-0 z-30', className)}>
      <motion.span
        aria-hidden
        data-slot="nav-bar-fill"
        style={{ opacity: solidity }}
        className="pointer-events-none absolute inset-0 -z-10 bg-surface/85 shadow-[0_1px_0_var(--color-line)] backdrop-blur-xl"
      />

      <nav
        aria-label="Sections"
        onPointerLeave={() => {
          setPointedAt(null);
        }}
        onBlur={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) {
            return;
          }

          setPointedAt(null);
        }}
        className="flex h-16 items-center gap-4 px-4 sm:gap-6 sm:px-6"
      >
        {brand === undefined ? null : <span className="flex shrink-0 items-center">{brand}</span>}

        <ActionMenu
          label="Places"
          className="shrink-0 md:hidden"
          trigger={<Icon of={Menu01Icon} size={20} />}
          groups={[
            {
              items: items.map((item) => ({
                id: item.id,
                label: item.label,
                ...(item.icon === undefined ? {} : { icon: item.icon }),
                ...(item.id === selectedId ? { detail: 'Here' } : {}),
                onChoose: () => {
                  onSelect(item.id);
                },
              })),
            },
          ]}
        />

        <ul className="valence-rail hidden min-w-0 items-center gap-0.5 overflow-x-auto md:flex">
          {items.map((item) => {
            const isCurrent = item.id === selectedId;

            return (
              <li key={item.id} className="shrink-0">
                <Button
                  variant="bare"
                  size="none"
                  label={item.label}
                  hasTooltip={false}
                  aria-current={isCurrent ? 'page' : undefined}
                  onPointerEnter={() => {
                    setPointedAt(item.id);
                  }}
                  onFocus={(event) => {
                    if (event.target.matches(':focus-visible')) {
                      setPointedAt(item.id);
                    }
                  }}
                  onClick={() => {
                    setPointedAt(item.id);
                    onSelect(item.id);
                  }}
                  className={cn(
                    'relative flex h-9 items-center gap-2 rounded-md px-3.5 text-sm',
                    MOVES,
                    isCurrent
                      ? 'font-medium text-text'
                      : lit === item.id
                        ? 'text-text'
                        : 'text-text-muted hover:text-text focus-visible:text-text',
                  )}
                >
                  {lit === item.id ? mark : null}

                  {item.icon === undefined ? null : (
                    <span
                      className={cn(
                        'relative z-10 flex overflow-hidden',
                        OPENS,
                        isCurrent
                          ? 'md:ml-0 md:w-[18px] md:opacity-100'
                          : 'md:-ml-2 md:w-0 md:opacity-0',
                      )}
                    >
                      <AnimatedIcon
                        isPlaying={!isCurrent && pointedAt === item.id}
                        icon={isCurrent ? (item.activeIcon ?? item.icon) : item.icon}
                        {...(isCurrent || item.gesture === undefined
                          ? {}
                          : { gesture: item.gesture })}
                        {...(isCurrent || item.activeIcon === undefined
                          ? {}
                          : { activeIcon: item.activeIcon })}
                      />
                    </span>
                  )}

                  <span className="relative z-10 hidden md:inline">{item.label}</span>
                </Button>
              </li>
            );
          })}
        </ul>

        <div ref={actionsRef} className="ml-auto flex shrink-0 items-center gap-0.5">
          {actions.map((action) =>
            action.control === undefined ? (
              <Button
                key={action.id}
                variant="bare"
                size="none"
                data-highlight={action.id}
                label={action.label}
                tooltipDelayMilliseconds={0}
                aria-current={action.isCurrent === true ? 'page' : undefined}
                onPointerEnter={() => {
                  setPointedAt(action.id);
                }}
                onFocus={(event) => {
                  if (event.target.matches(':focus-visible')) {
                    setPointedAt(action.id);
                  }
                }}
                onClick={action.onSelect}
                className={cn(
                  'relative flex size-9 items-center justify-center rounded-md text-sm',
                  MOVES,
                  lit === action.id || action.isCurrent === true
                    ? 'font-medium text-text'
                    : 'text-text-muted hover:text-text focus-visible:text-text',
                )}
              >
                {lit === action.id ? mark : null}

                <span className="relative z-10 flex">
                  <AnimatedIcon
                    isPlaying={pointedAt === action.id}
                    isStilled={openAction === action.id}
                    icon={
                      action.isCurrent === true ? (action.activeIcon ?? action.icon) : action.icon
                    }
                    {...(action.gesture === undefined ? {} : { gesture: action.gesture })}
                    {...(action.activeIcon === undefined ? {} : { activeIcon: action.activeIcon })}
                  />
                </span>

                {action.badge === undefined ? null : (
                  <span className="absolute -right-0.5 -top-0.5 z-10">{action.badge}</span>
                )}
              </Button>
            ) : (
              <div
                key={action.id}
                data-highlight={action.id}
                onPointerEnter={() => {
                  setPointedAt(action.id);
                }}
                onFocus={(event) => {
                  if (event.target.matches(':focus-visible')) {
                    setPointedAt(action.id);
                  }
                }}
                className={cn(
                  'relative flex items-center',
                  MOVES,
                  lit === action.id || action.isCurrent === true
                    ? 'text-text'
                    : 'text-text-muted hover:text-text focus-visible:text-text',
                )}
              >
                {lit === action.id ? mark : null}

                <span className="relative z-10 flex">
                  <AnimatedIcon
                    isPlaying={pointedAt === action.id}
                    isStilled={openAction === action.id}
                    icon={action.control}
                    {...(action.gesture === undefined ? {} : { gesture: action.gesture })}
                  />
                </span>
              </div>
            ),
          )}
        </div>
      </nav>
    </header>
  );
};

NavBar.displayName = 'NavBar';

export { NavBar };
