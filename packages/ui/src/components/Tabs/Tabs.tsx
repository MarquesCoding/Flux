import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from '@ValenceUI/cn';
import type { TabsProps } from './Tabs.types';

/**
 * Holds which of a set of panels is showing, and hands that down to the bar and the panels so
 * neither has to know about the other. Controlled rather than holding its own state, since which
 * tab is open usually belongs in the address.
 *
 * A tab is chosen when it is pressed rather than when it is arrowed onto, so moving across a bar
 * with the keyboard does not open — and fetch — every panel on the way past.
 *
 * @param value - Which tab is showing.
 * @param onValueChange - Told which tab was chosen.
 * @param children - The bar and the panels.
 * @param className - Extra classes for the caller's own layout.
 */
const Tabs = ({ value, onValueChange, children, className }: TabsProps) => (
  <RadixTabs.Root
    activationMode="manual"
    value={value}
    onValueChange={(next) => {
      onValueChange(String(next));
    }}
    className={cn('contents', className)}
  >
    {children}
  </RadixTabs.Root>
);

Tabs.displayName = 'Tabs';

export { Tabs };
