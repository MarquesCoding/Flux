import { Tabs } from '@base-ui/react/tabs';
import { cn } from '@FluxUI/cn';
import type { TabPanelProps } from './TabPanel.types';

/**
 * What one tab shows.
 */
const TabPanel = ({ value, children, render, className }: TabPanelProps) => (
  <Tabs.Panel value={value} className={cn(className)} {...(render === undefined ? {} : { render })}>
    {children}
  </Tabs.Panel>
);

TabPanel.displayName = 'TabPanel';

export { TabPanel };
