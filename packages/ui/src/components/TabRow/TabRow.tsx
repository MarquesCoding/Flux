import { Tabs } from '@base-ui/react/tabs';
import { cn } from '@FluxUI/cn';
import type { TabRowProps } from './TabRow.types';

/**
 * A row of places, as pills.
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
