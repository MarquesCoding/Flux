import { Tabs } from '@base-ui/react/tabs';
import { cn } from '@FluxUI/cn';
import type { TabRowProps } from './TabRow.types';

/**
 * A row of places, as pills.
 *
 * A column down the side gave each section a line of its own and cost a
 * quarter of the page to say eight words. Across the top they take one line,
 * and the page beneath gets the width — which is what a page of tables and
 * figures wanted in the first place.
 *
 * Grouping survives the move as a hairline rather than a heading: the sections
 * still arrive in their families, and the rule says where one ends without
 * spending a row on the word.
 *
 * One mark slides between them rather than each pill lighting itself, so the
 * eye follows a single moving thing. Glass, the same height and the same
 * travelling mark as the navigation dock, because it is the same gesture
 * answering the same question — where am I, and where could I go — and two
 * ways of saying that is one too many.
 *
 * Belongs inside `Tabs`, which is where it learns which one is showing.
 */
const TabRow = ({ label, groups, className }: TabRowProps) => (
  <Tabs.List
    aria-label={label}
    className={cn(
      'flux-rail flux-glass relative flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full p-1.5',
      className,
    )}
  >
    <Tabs.Indicator
      className={cn(
        'absolute bottom-1.5 left-[var(--active-tab-left)] top-1.5 w-[var(--active-tab-width)]',
        'rounded-full bg-[var(--surface-active)]',
        'transition-[left,width] duration-[var(--duration-base)] ease-[var(--ease-soft)]',
        'motion-reduce:transition-none',
      )}
    />

    {groups.map((group, index) => (
      <div key={group.label ?? `group-${index.toString()}`} className="flex items-center gap-1">
        {index === 0 ? null : (
          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-[var(--surface-divider)]" />
        )}

        {group.items.map((item) => (
          <Tabs.Tab
            key={item.id}
            value={item.id}
            className={cn(
              'relative flex h-9 shrink-0 cursor-pointer items-center rounded-full px-3.5 text-sm',
              'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-soft)]',
              'text-text-muted hover:text-text focus-visible:text-text',
              'data-[selected]:font-medium data-[selected]:text-text',
            )}
          >
            {item.label}
          </Tabs.Tab>
        ))}
      </div>
    ))}
  </Tabs.List>
);

TabRow.displayName = 'TabRow';

export { TabRow };
