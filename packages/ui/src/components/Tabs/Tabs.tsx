import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { cn } from '@FluxUI/cn';
import type { TabsProps } from './Tabs.types';

/**
 * A set of panels, one of which is showing, and the bar that chooses between them.
 */
const Tabs = ({ value, onValueChange, children, className }: TabsProps) => (
  <BaseTabs.Root
    value={value}
    onValueChange={(next) => {
      onValueChange(String(next));
    }}
    className={cn('contents', className)}
  >
    {children}
  </BaseTabs.Root>
);

Tabs.displayName = 'Tabs';

export { Tabs };
