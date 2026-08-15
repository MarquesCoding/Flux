import { Popover } from '@base-ui/react/popover';
import { cn } from '@FluxUI/cn';
import { Tooltip } from '@FluxUI/Tooltip';
import { usePortalContainer } from '@FluxUI/usePortalContainer';
import type { PopoverPanelProps } from './PopoverPanel.types';

/**
 * A panel of glass hung off a control.
 *
 * The plumbing every overlay on the player needs and none of them should own:
 * a trigger the size of the other buttons, a panel above it that stays inside
 * the window, and the same glass as the bar it belongs to. What goes inside is
 * the caller's business.
 */
const PopoverPanel = ({
  label,
  trigger,
  children,
  heading,
  isOpen,
  onOpenChange,
  side = 'top',
  isDisabled = false,
  className,
}: PopoverPanelProps) => {
  const portalContainer = usePortalContainer();

  return (
    <Popover.Root
      {...(isOpen === undefined ? {} : { open: isOpen })}
      {...(onOpenChange === undefined ? {} : { onOpenChange })}
    >
      <Tooltip label={label} side={side === 'top' ? 'top' : 'bottom'}>
        <Popover.Trigger
          aria-label={label}
          disabled={isDisabled}
          className={cn(
            'inline-flex size-10 shrink-0 items-center justify-center rounded-full',
            'text-current transition-colors hover:bg-white/15',
            'data-[popup-open]:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {trigger}
        </Popover.Trigger>
      </Tooltip>

      <Popover.Portal container={portalContainer}>
        <Popover.Positioner
          side={side}
          sideOffset={12}
          align="end"
          collisionPadding={12}
          className="z-50"
        >
          <Popover.Popup
            aria-label={label}
            className={cn(
              'flux-glass flex max-h-[70vh] flex-col overflow-hidden rounded-2xl p-3 text-white',
              className,
            )}
          >
            {heading === undefined ? null : (
              <h3 className="shrink-0 px-1 pb-3 text-base font-medium tracking-tight">{heading}</h3>
            )}

            <div className="flux-rail min-h-0 flex-1 overflow-y-auto">{children}</div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};

PopoverPanel.displayName = 'PopoverPanel';

export { PopoverPanel };
