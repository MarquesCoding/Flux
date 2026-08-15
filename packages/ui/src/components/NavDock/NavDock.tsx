import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { AnimatedIcon } from '@FluxUI/AnimatedIcon';
import { Button } from '@FluxUI/Button';
import { cn } from '@FluxUI/cn';
import type { NavDockProps } from './NavDock.types';

/**
 * How the mark travels between items.
 *
 * A spring rather than a duration: it is following a pointer, and a pointer
 * does not move on a curve somebody chose in advance. Stiff enough to keep up
 * with a quick pass along the dock, damped enough not to wobble when it lands.
 */
const MARK_MOTION = { type: 'spring', stiffness: 480, damping: 38 } as const;

/**
 * The one bar, floating.
 *
 * Places and tools used to be two capsules with a gap between them, which read
 * as two navigations rather than one — a viewer had to learn which half of the
 * screen answered which question. They are one dock now, divided by a hairline
 * instead of by empty space: still plainly two kinds of thing, but plainly one
 * bar holding them.
 *
 * One mark, not two. It rests on the place being stood on, follows the pointer
 * to whatever it passes over, and returns the moment the pointer leaves. Two
 * backgrounds — one lit, one hovered — meant the dock always had a spare
 * highlight lying about claiming to mean something; this way the mark is
 * always answering the same question, which is "what would happen if I pressed
 * now".
 *
 * The names arrive at once rather than after a pause. A tooltip waits so that
 * crossing a bar of controls does not flash a box on each one, but here the
 * bar is nothing but icons and the name is the only thing saying what each
 * does — waiting is the interface withholding the one thing being asked for.
 *
 * The names are tooltips above the icons rather than words beside them. A word
 * that opens inline pushes every icon along as the pointer arrives, so the
 * thing being aimed at moves while it is being aimed at — and on a dock, where
 * the pointer travels the whole row, that happens on every pass. Above the
 * icon, the row holds still and the mark is the only thing that moves.
 *
 * The filled icon stays with the place actually being stood on, so that
 * pointing at somewhere else never loses where you are.
 *
 * At the foot of the window rather than the head of it. The top of a page is
 * where the thing being looked at introduces itself — a title, a hero, the
 * first row of a library — and a bar pinned over that is a bar covering the
 * one part of the page that was doing the explaining. Down here it is under
 * the thumb and out of the way of the artwork.
 *
 * Glass, so what passes beneath carries on being visible: the page belongs to
 * what is being shown, and the navigation rests on top of it.
 */
const NavDock = ({ brand, items, selectedId, onSelect, actions = [], className }: NavDockProps) => {
  const prefersReducedMotion = useReducedMotion();
  const isStill = prefersReducedMotion === true;
  const [pointedAt, setPointedAt] = useState<string | null>(null);

  const lit = pointedAt ?? selectedId;

  const mark = (
    <motion.span
      layoutId="nav-dock-mark"
      transition={isStill ? { duration: 0 } : MARK_MOTION}
      className="absolute inset-0 -z-10 rounded-full bg-[var(--surface-active)]"
    />
  );

  return (
    <header
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-4 sm:px-6',
        className,
      )}
    >
      <nav aria-label="Sections" className="mx-auto flex max-w-fit justify-center">
        <div
          onPointerLeave={() => {
            setPointedAt(null);
          }}
          onBlur={() => {
            setPointedAt(null);
          }}
          className="flux-glass pointer-events-auto relative flex items-center gap-1 rounded-full p-1.5"
        >
          {brand === undefined ? null : (
            <span className="relative z-10 flex shrink-0 items-center pl-2 pr-1">{brand}</span>
          )}

          <ul className="relative z-10 flex min-w-0 items-center gap-0.5">
            {items.map((item) => {
              const isCurrent = item.id === selectedId;
              const isNamed = lit === item.id;

              return (
                <li key={item.id} className="shrink-0">
                  <Button
                    variant="bare"
                    size="none"
                    data-highlight={item.id}
                    label={item.label}
                    tooltipDelayMilliseconds={0}
                    aria-current={isCurrent ? 'page' : undefined}
                    onPointerEnter={() => {
                      setPointedAt(item.id);
                    }}
                    onFocus={() => {
                      setPointedAt(item.id);
                    }}
                    onClick={() => {
                      onSelect(item.id);
                    }}
                    className={cn(
                      'relative flex h-9 items-center gap-1.5 rounded-full px-3 text-sm',
                      'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-soft)]',
                      isNamed || isCurrent
                        ? 'font-medium text-text'
                        : 'text-text-muted hover:text-text focus-visible:text-text',
                    )}
                  >
                    {isNamed ? mark : null}

                    {item.icon === undefined ? null : (
                      <AnimatedIcon
                        isPlaying={pointedAt === item.id}
                        icon={isCurrent ? (item.activeIcon ?? item.icon) : item.icon}
                        {...(item.gesture === undefined ? {} : { gesture: item.gesture })}
                        {...(item.activeIcon === undefined ? {} : { activeIcon: item.activeIcon })}
                      />
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>

          {actions.length === 0 ? null : (
            <span
              aria-hidden
              className="relative z-10 mx-1.5 h-6 w-px shrink-0 bg-[var(--surface-divider)]"
            />
          )}

          <div className="relative z-10 flex shrink-0 items-center gap-0.5">
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
                  onFocus={() => {
                    setPointedAt(action.id);
                  }}
                  onClick={action.onSelect}
                  className={cn(
                    'relative flex h-9 items-center justify-center gap-1.5 rounded-full px-2.5 text-sm',
                    'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-soft)]',
                    lit === action.id || action.isCurrent === true
                      ? 'font-medium text-text'
                      : 'text-text-muted hover:text-text focus-visible:text-text',
                  )}
                >
                  {lit === action.id ? mark : null}

                  <AnimatedIcon
                    isPlaying={pointedAt === action.id}
                    icon={
                      action.isCurrent === true ? (action.activeIcon ?? action.icon) : action.icon
                    }
                    {...(action.gesture === undefined ? {} : { gesture: action.gesture })}
                    {...(action.activeIcon === undefined ? {} : { activeIcon: action.activeIcon })}
                  />

                  {action.badge === undefined ? null : (
                    <span className="absolute -right-0.5 -top-0.5">{action.badge}</span>
                  )}
                </Button>
              ) : (
                <div
                  key={action.id}
                  data-highlight={action.id}
                  onPointerEnter={() => {
                    setPointedAt(action.id);
                  }}
                  onFocus={() => {
                    setPointedAt(action.id);
                  }}
                  className={cn(
                    'relative flex items-center',
                    'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-soft)]',
                    lit === action.id || action.isCurrent === true
                      ? 'text-text'
                      : 'text-text-muted hover:text-text focus-visible:text-text',
                  )}
                >
                  {lit === action.id ? mark : null}

                  <AnimatedIcon
                    isPlaying={pointedAt === action.id}
                    icon={action.control}
                    {...(action.gesture === undefined ? {} : { gesture: action.gesture })}
                  />
                </div>
              ),
            )}
          </div>
        </div>
      </nav>
    </header>
  );
};

NavDock.displayName = 'NavDock';

export { NavDock };
