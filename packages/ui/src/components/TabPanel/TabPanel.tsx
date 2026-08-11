import { Tabs } from '@base-ui/react/tabs';
import { cn } from '@FluxUI/cn';
import type { TabPanelProps } from './TabPanel.types';

/**
 * What one tab shows.
 *
 * Named by its tab rather than shown by a condition, which is the point: a
 * panel gated behind `showing === 'devices' ? ... : null` is invisible to
 * everything that has to know a tab controls something — the tab's own
 * `aria-controls`, and where focus goes when somebody presses it.
 *
 * Only the showing panel is in the document. A hidden one is not rendered at
 * all rather than rendered and hidden, so nothing in it is fetching, playing or
 * counting while nobody is looking at it.
 */
const TabPanel = ({ value, children, render, className }: TabPanelProps) => (
  <Tabs.Panel value={value} className={cn(className)} {...(render === undefined ? {} : { render })}>
    {children}
  </Tabs.Panel>
);

TabPanel.displayName = 'TabPanel';

export { TabPanel };
