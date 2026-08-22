import { cloneElement } from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from '@ValenceUI/cn';
import type { TabPanelProps } from './TabPanel.types';

/**
 * What one tab shows. Renders only when its tab is the one chosen, so a panel that fetches
 * something does not fetch it until somebody looks.
 *
 * Where a caller supplies an element to render as, the panel's own content goes inside it rather
 * than replacing it — the element is the wrapper, not the contents.
 *
 * @param value - Which tab this panel belongs to.
 * @param children - What the panel holds.
 * @param render - An element to render as, where a plain division is not the right thing.
 * @param className - Extra classes for the caller's own layout.
 */
const TabPanel = ({ value, children, render, className }: TabPanelProps) => (
  <RadixTabs.Content
    value={value}
    asChild={render !== undefined}
    className={cn(
      'outline-none data-[state=active]:animate-in data-[state=active]:fade-in-0',
      'duration-[var(--duration-fast)] ease-[var(--ease-out)]',
      'motion-reduce:duration-[var(--duration-instant)]',
      className,
    )}
  >
    {render === undefined ? children : cloneElement(render, undefined, children)}
  </RadixTabs.Content>
);

TabPanel.displayName = 'TabPanel';

export { TabPanel };
