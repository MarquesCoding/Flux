import * as RadixPopover from '@radix-ui/react-popover';
import { cn } from '@FluxUI/cn';
import { POPUP_MOTION } from '@FluxUI/animations/motion';
import { Tooltip } from '@FluxUI/Tooltip';
import { usePortalContainer } from '@FluxUI/usePortalContainer';
import type { PopoverPanelProps } from './PopoverPanel.types';

/**
 * A panel of glass hung off the control that opened it, positioned to stay on screen wherever that
 * control happens to be. For anything richer than a menu — a form, a chart, a list with its own
 * controls — where a menu's row-per-item shape would be wrong.
 *
 * @param label - What the panel holds, read out on opening.
 * @param trigger - The control that opens it.
 * @param children - What the panel holds.
 * @param heading - A title across its top.
 * @param isOpen - Whether it is open, for a caller holding that state itself.
 * @param onOpenChange - Told when it opens or closes.
 * @param side - Which side of the trigger to prefer.
 * @param align - Which part of the trigger the panel lines up with, matching `ActionMenu`.
 * @param isDisabled - Whether it can be opened at all.
 * @param className - Extra classes for the caller's own layout.
 */
const PopoverPanel = ({
  label,
  trigger,
  children,
  heading,
  isOpen,
  onOpenChange,
  side = 'top',
  align = 'end',
  isDisabled = false,
  className,
}: PopoverPanelProps) => {
  const portalContainer = usePortalContainer();

  return (
    <RadixPopover.Root
      {...(isOpen === undefined ? {} : { open: isOpen })}
      {...(onOpenChange === undefined ? {} : { onOpenChange })}
    >
      <Tooltip label={label} side={side === 'top' ? 'top' : 'bottom'}>
        <RadixPopover.Trigger
          aria-label={label}
          disabled={isDisabled}
          data-slot="popover-trigger"
          className={cn(
            'inline-flex size-10 shrink-0 items-center justify-center rounded-md',
            'text-current outline-none hover:bg-white/15',
            'transition-colors duration-[var(--duration-instant)] ease-[var(--ease-out)]',
            'motion-reduce:transition-none',
            'focus-visible:ring-[3px] focus-visible:ring-ring/40',
            'data-[state=open]:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {trigger}
        </RadixPopover.Trigger>
      </Tooltip>

      <RadixPopover.Portal
        {...(portalContainer === undefined ? {} : { container: portalContainer })}
      >
        <RadixPopover.Content
          aria-label={label}
          side={side}
          sideOffset={12}
          align={align}
          collisionPadding={12}
          data-slot="popover-content"
          className={cn(
            'z-50 flux-glass flex max-h-[70vh] flex-col overflow-hidden rounded-lg p-3 text-white',
            'outline-none',
            POPUP_MOTION,
            className,
          )}
        >
          {heading === undefined ? null : (
            <h3 className="shrink-0 px-1 pb-3 text-base font-medium tracking-tight">{heading}</h3>
          )}

          <div className="flux-rail min-h-0 flex-1 overflow-y-auto">{children}</div>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
};

PopoverPanel.displayName = 'PopoverPanel';

export { PopoverPanel };
