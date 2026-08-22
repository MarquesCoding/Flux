import * as RadixTooltip from '@radix-ui/react-tooltip';
import { tooltipScopeContext } from '@ValenceUI/tooltipScopeContext';
import type { TooltipScopeProps } from './TooltipScope.types';

const SKIP_DELAY_MILLISECONDS = 300;

/**
 * Holds whether a tooltip is already showing, for every tooltip on the page.
 *
 * Wrapped once near the root and nowhere else. The pause before a name appears exists so that
 * crossing a row of icons does not flash one on each; once any name is showing that pause has done
 * its job, and the next name should be instant. That skip is shared state, so it needs one owner —
 * a scope per tooltip means every tooltip is the first tooltip and none of them ever skips, which is
 * the difference between a toolbar that feels quick and one that feels reluctant.
 *
 * @param children - The application.
 * @returns The application, with its tooltips able to agree about the pause.
 */
const TooltipScope = ({ children }: TooltipScopeProps) => (
  <tooltipScopeContext.Provider value>
    <RadixTooltip.Provider skipDelayDuration={SKIP_DELAY_MILLISECONDS}>
      {children}
    </RadixTooltip.Provider>
  </tooltipScopeContext.Provider>
);

TooltipScope.displayName = 'TooltipScope';

export { TooltipScope, SKIP_DELAY_MILLISECONDS };
