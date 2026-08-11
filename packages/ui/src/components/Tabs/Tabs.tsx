import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { cn } from '@FluxUI/cn';
import type { TabsProps } from './Tabs.types';

/**
 * A set of panels, one of which is showing, and the bar that chooses between
 * them.
 *
 * Wraps both: a tab that does not know its panel is a button, and a panel that
 * does not know its tab is a div. Base UI ties the two together — which tab
 * controls which panel, what the arrow keys do, and where focus lands — and
 * that wiring is the whole reason this exists rather than a boolean and a
 * ternary.
 *
 * Lays nothing out. It renders as its own contents so a page can put the bar
 * and the panels wherever its own layout wants them.
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
