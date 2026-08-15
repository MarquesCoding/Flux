import { Tabs } from '@base-ui/react/tabs';
import { cn } from '@FluxUI/cn';
import type { TabBarProps } from './TabBar.types';

/**
 * Words across the top that choose what is beneath them.
 */
const TabBar = ({ tabs, label, className }: TabBarProps) => (
  <Tabs.List
    aria-label={label}
    className={cn(
      'flux-rail relative flex items-center gap-6 overflow-x-auto px-5 sm:px-10',
      className,
    )}
  >
    {tabs.map((tab) => (
      <Tabs.Tab
        key={tab.id}
        value={tab.id}
        className={cn(
          'shrink-0 cursor-pointer py-3 text-xl font-semibold tracking-tight sm:text-2xl',
          'text-text-muted/60 transition-colors hover:text-text-muted',
          'data-[selected]:text-text',
        )}
      >
        {tab.label}
      </Tabs.Tab>
    ))}

    <Tabs.Indicator
      className={cn(
        'absolute bottom-0 left-[var(--active-tab-left)] h-0.5 w-[var(--active-tab-width)]',
        'rounded-full bg-text transition-[left,width] duration-300 ease-out',
        'motion-reduce:transition-none',
      )}
    />
  </Tabs.List>
);

TabBar.displayName = 'TabBar';

export { TabBar };
