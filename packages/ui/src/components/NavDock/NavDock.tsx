import { useState } from 'react';
import { AnimatedIcon } from '@FluxUI/AnimatedIcon';
import { Button } from '@FluxUI/Button';
import { SlidingMark } from '@FluxUI/SlidingMark';
import { cn } from '@FluxUI/cn';
import { useOpenAction } from './useOpenAction';
import type { NavDockProps } from './NavDock.types';

/**
 * The platform's one navigation bar, floating at the foot of the window: the places in the middle,
 * the tools at the right, divided by a hairline rather than by empty space so it reads as one bar
 * rather than two. A single mark rests on where you are, follows the pointer to whatever it passes
 * over, and returns when the pointer leaves. At the foot rather than the head because the top of a
 * page is where the thing being looked at introduces itself.
 *
 * An action whose control has a panel open holds still while it is open. The gesture is a hover
 * affordance saying what pressing an icon would do, and a popover is anchored to the icon that
 * opened it — so an icon that kept moving would drag the open panel around at exactly the moment
 * somebody is reaching for it.
 *
 * @param brand - The mark at the head of the dock.
 * @param items - The places, in the order they are shown.
 * @param selectedId - Which place is being stood on.
 * @param onSelect - Told which place was chosen.
 * @param actions - The tools at the right, which do something rather than going somewhere.
 * @param className - Extra classes for the caller's own layout.
 */
const NavDock = ({ brand, items, selectedId, onSelect, actions = [], className }: NavDockProps) => {
  const [pointedAt, setPointedAt] = useState<string | null>(null);
  const { actionsRef, openAction } = useOpenAction();

  const lit = pointedAt ?? selectedId;

  const mark = <SlidingMark group="nav-dock-mark" />;

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

          <div ref={actionsRef} className="relative z-10 flex shrink-0 items-center gap-0.5">
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
                    isPlaying={pointedAt === action.id && openAction !== action.id}
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
                    isPlaying={pointedAt === action.id && openAction !== action.id}
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
