import { Tabs } from '@base-ui/react/tabs';
import { cn } from '@FluxUI/cn';
import type { SideNavProps } from './SideNav.types';

/**
 * A column of sections that chooses what is beside it.
 *
 * For a page with more destinations than a row across the top can hold. A
 * horizontal strip stops working somewhere around seven, and the answer is not
 * a second row — it is turning the list on its side, where twenty fit and
 * headings can group them.
 *
 * Belongs inside `Tabs`, like `TabBar`, which is where it learns which section
 * is showing. It is told nothing about that directly: a nav that is passed the
 * answer as well as sitting inside the thing that knows it is two answers to
 * keep in step.
 *
 * Lies down again below `lg`. A column of headings down the side of a phone
 * leaves nothing beside it, so on a narrow screen it scrolls across the top
 * instead — the same list, turned back the way it came.
 */
const SideNav = ({ groups, label, className }: SideNavProps) => (
  <Tabs.List
    aria-label={label}
    className={cn(
      'flux-rail flex gap-1 overflow-x-auto lg:flex-col lg:gap-4 lg:overflow-visible',
      className,
    )}
  >
    {groups.map((group) => (
      <div key={group.label ?? 'top'} className="flex shrink-0 gap-1 lg:flex-col lg:gap-0.5">
        {group.label === null ? null : (
          <span className="hidden px-3 pb-1 text-xs uppercase tracking-[0.16em] text-text-muted lg:block">
            {group.label}
          </span>
        )}

        {group.items.map((item) => (
          <Tabs.Tab
            key={item.id}
            value={item.id}
            className={cn(
              'flex shrink-0 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm',
              'text-text-muted transition-colors hover:bg-white/[0.04] hover:text-text',
              'data-[selected]:bg-white/[0.06] data-[selected]:text-text',
            )}
          >
            {item.icon === undefined ? null : (
              <span className="shrink-0" aria-hidden>
                {item.icon}
              </span>
            )}

            <span className="whitespace-nowrap">{item.label}</span>

            {item.badge === undefined ? null : (
              <span className="ml-auto shrink-0 tabular-nums">{item.badge}</span>
            )}
          </Tabs.Tab>
        ))}
      </div>
    ))}
  </Tabs.List>
);

SideNav.displayName = 'SideNav';

export { SideNav };
