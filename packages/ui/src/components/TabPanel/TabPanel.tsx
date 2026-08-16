import { Tabs } from '@base-ui/react/tabs';
import { cn } from '@FluxUI/cn';
import type { TabPanelProps } from './TabPanel.types';

/**
 * What one tab shows. Renders only when its tab is the one chosen, so a panel that fetches
 * something does not fetch it until somebody looks.
 *
 * @param value - Which tab this panel belongs to.
 * @param children - What the panel holds.
 * @param render - An element to render as, where a plain division is not the right thing.
 * @param className - Extra classes for the caller's own layout.
 */
const TabPanel = ({ value, children, render, className }: TabPanelProps) => (
  <Tabs.Panel value={value} className={cn(className)} {...(render === undefined ? {} : { render })}>
    {children}
  </Tabs.Panel>
);

TabPanel.displayName = 'TabPanel';

export { TabPanel };
