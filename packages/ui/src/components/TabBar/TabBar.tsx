import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from '@ValenceUI/cn';
import { SlidingMark } from '@ValenceUI/SlidingMark';
import type { TabBarProps } from './TabBar.types';

/**
 * The words across the top of a set of panels that choose which one is beneath them. Pairs with
 * `Tabs`, which holds which is chosen, so the bar can sit anywhere in the layout rather than
 * immediately above the panel it controls.
 *
 * @param tabs - The tabs, each with what it is called.
 * @param value - Which tab is showing, so the rule beneath it can travel there.
 * @param label - What the set of tabs is for, read out to anybody who cannot see it.
 * @param className - Extra classes for the caller's own layout.
 */
const TabBar = ({ tabs, label, value, className }: TabBarProps) => (
  <RadixTabs.List
    aria-label={label}
    className={cn(
      'flux-rail relative flex items-center gap-6 overflow-x-auto px-5 sm:px-10',
      className,
    )}
  >
    {tabs.map((tab) => (
      <RadixTabs.Trigger
        key={tab.id}
        value={tab.id}
        className={cn(
          'relative shrink-0 cursor-pointer py-3 text-xl font-semibold tracking-tight sm:text-2xl',
          'text-text-muted/60 outline-none hover:text-text-muted',
          'transition-colors duration-[var(--duration-instant)] ease-[var(--ease-out)]',
          'motion-reduce:transition-none focus-visible:text-text',
          'data-[state=active]:text-text',
        )}
      >
        {tab.label}

        {value === tab.id ? (
          <SlidingMark
            group={`tab-bar-${label}`}
            className="inset-x-0 inset-y-auto bottom-0 h-0.5 rounded-full bg-text"
          />
        ) : null}
      </RadixTabs.Trigger>
    ))}
  </RadixTabs.List>
);

TabBar.displayName = 'TabBar';

export { TabBar };
