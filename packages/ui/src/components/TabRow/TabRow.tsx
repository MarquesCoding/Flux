import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from '@FluxUI/cn';
import { SlidingMark } from '@FluxUI/SlidingMark';
import type { TabRowProps } from './TabRow.types';

/**
 * A row of places drawn as pills, for a set of destinations rather than a set of panels — the
 * distinction being that these change where you are, not what is under a bar. Items can be grouped,
 * with a hairline between the groups.
 *
 * @param groups - The places, in groups.
 * @param value - Which place is current, so the highlight can travel to it.
 * @param label - What the row is for, read out to anybody who cannot see it.
 * @param className - Extra classes for the caller's own layout.
 */
const TabRow = ({ label, groups, value, className }: TabRowProps) => (
  <RadixTabs.List
    aria-label={label}
    className={cn(
      'flux-rail flux-glass relative flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg p-1.5',
      className,
    )}
  >
    {groups.map((group, index) => (
      <div key={group.label ?? `group-${index.toString()}`} className="flex items-center gap-1">
        {index === 0 ? null : (
          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-[var(--surface-divider)]" />
        )}

        {group.items.map((item) => (
          <RadixTabs.Trigger
            key={item.id}
            value={item.id}
            className={cn(
              'relative flex h-9 shrink-0 cursor-pointer items-center rounded-md px-3.5 text-sm outline-none',
              'transition-colors duration-[var(--duration-instant)] ease-[var(--ease-out)]',
              'motion-reduce:transition-none',
              'text-text-muted hover:text-text focus-visible:text-text',
              'focus-visible:ring-[3px] focus-visible:ring-ring/40',
              'data-[state=active]:font-medium data-[state=active]:text-text',
            )}
          >
            {value === item.id ? <SlidingMark group={`tab-row-${label}`} /> : null}
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </div>
    ))}
  </RadixTabs.List>
);

TabRow.displayName = 'TabRow';

export { TabRow };
