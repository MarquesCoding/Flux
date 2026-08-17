import * as RadixTooltip from '@radix-ui/react-tooltip';
import { cn } from '@FluxUI/cn';
import { usePortalContainer } from '@FluxUI/usePortalContainer';
import type { TooltipProps } from './Tooltip.types';

const DELAY_MILLISECONDS = 450;

const POPUP_MOTION = [
  'origin-[var(--radix-tooltip-content-transform-origin)]',
  'data-[state=delayed-open]:animate-in data-[state=closed]:animate-out',
  'data-[state=delayed-open]:fade-in-0 data-[state=closed]:fade-out-0',
  'data-[state=delayed-open]:zoom-in-95 data-[state=closed]:zoom-out-95',
  'duration-[var(--duration-fast)] ease-[var(--ease-out)]',
  'motion-reduce:animate-none',
].join(' ');

/**
 * Names a control for the pointer that has stopped on it, which is how a bar of icons stays
 * learnable. Wraps the control rather than sitting beside it, so the name is attached to the thing
 * it names for anybody reading the page rather than looking at it.
 *
 * It grows from the edge nearest the control rather than from its own middle, which is what makes it
 * read as belonging to that control rather than as a card that happened to appear.
 *
 * @param label - What the control does.
 * @param children - The control being named.
 * @param side - Which side of the control to appear on.
 * @param isDisabled - Whether to say nothing at all, for a control whose name is already written.
 * @param delayMilliseconds - How long the pointer rests before the name appears.
 */
const Tooltip = ({
  label,
  children,
  side = 'top',
  isDisabled = false,
  delayMilliseconds = DELAY_MILLISECONDS,
}: TooltipProps) => {
  const portalContainer = usePortalContainer();

  if (isDisabled) {
    return children;
  }

  return (
    <RadixTooltip.Provider delayDuration={delayMilliseconds}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>

        <RadixTooltip.Portal {...(portalContainer === undefined ? {} : { container: portalContainer })}>
          <RadixTooltip.Content
            aria-hidden
            side={side}
            sideOffset={8}
            collisionPadding={8}
            data-slot="tooltip-content"
            className={cn(
              'z-50 flux-glass rounded-md px-2 py-1 text-xs font-medium text-white shadow-[var(--shadow-lifted)]',
              POPUP_MOTION,
            )}
          >
            {label}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
};

Tooltip.displayName = 'Tooltip';

export { Tooltip };
