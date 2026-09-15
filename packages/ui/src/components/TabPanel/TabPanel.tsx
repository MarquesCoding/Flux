import { cloneElement } from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';
import { motion, useReducedMotionConfig } from 'motion/react';
import { cn } from '@ValenceUI/cn';
import type { TabPanelProps } from './TabPanel.types';

const SLIDES_IN_BY_PIXELS = 24;

/**
 * What one tab shows. Renders only when its tab is the one chosen, so a panel that fetches
 * something does not fetch it until somebody looks.
 *
 * Where a caller supplies an element to render as, the panel's own content goes inside it rather
 * than replacing it — the element is the wrapper, not the contents.
 *
 * Given a direction, the panel arrives from the side it was reached from, the way a submenu does:
 * forwards and it comes in from the right, back and it comes in from the left. Only what arrives
 * moves — what left has already gone, and animating it out would hold up the thing being waited for.
 *
 * @param value - Which tab this panel belongs to.
 * @param children - What the panel holds.
 * @param render - An element to render as, where a plain division is not the right thing.
 * @param travel - Which way the tabs were moved through, from `useTravelDirection`.
 * @param className - Extra classes for the caller's own layout.
 */
const TabPanel = ({ value, children, render, travel, className }: TabPanelProps) => {
  const prefersReducedMotion = useReducedMotionConfig();

  const held =
    travel === undefined || prefersReducedMotion === true ? (
      children
    ) : (
      <motion.div
        key={value}
        initial={{ opacity: 0, x: travel * SLIDES_IN_BY_PIXELS }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 40 }}
      >
        {children}
      </motion.div>
    );

  return (
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
      {render === undefined ? held : cloneElement(render, undefined, held)}
    </RadixTabs.Content>
  );
};

TabPanel.displayName = 'TabPanel';

export { TabPanel };
