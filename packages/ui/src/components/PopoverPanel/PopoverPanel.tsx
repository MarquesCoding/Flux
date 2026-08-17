import { Popover } from '@base-ui/react/popover';
import { cn } from '@FluxUI/cn';
import { POPUP_MOTION } from '@FluxUI/animations/popup';
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
          align={align}
          collisionPadding={12}
          className="z-50"
        >
          <Popover.Popup
            aria-label={label}
            className={cn(
              'flux-glass flex max-h-[70vh] flex-col overflow-hidden rounded-2xl p-3 text-white',
              POPUP_MOTION,
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
