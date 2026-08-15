import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import { usePortalContainer } from '@FluxUI/usePortalContainer';
import type { TooltipProps } from './Tooltip.types';

const DELAY_MILLISECONDS = 450;

const POPUP_MOTION = [
  'transition-[opacity,transform,translate,scale] duration-150 ease-out',
  'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
  'data-[starting-style]:scale-95 data-[ending-style]:scale-95',
  'data-[side=top]:origin-bottom data-[side=bottom]:origin-top',
  'data-[side=left]:origin-right data-[side=right]:origin-left',
  'data-[side=top]:data-[starting-style]:translate-y-1',
  'data-[side=bottom]:data-[starting-style]:-translate-y-1',
  'data-[side=left]:data-[starting-style]:translate-x-1',
  'data-[side=right]:data-[starting-style]:-translate-x-1',
  'motion-reduce:transition-opacity',
  'motion-reduce:data-[starting-style]:scale-100 motion-reduce:data-[ending-style]:scale-100',
  'motion-reduce:data-[starting-style]:translate-x-0 motion-reduce:data-[starting-style]:translate-y-0',
].join(' ');

/**
 * The name of a control, for the pointer that has stopped on it.
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
    <BaseTooltip.Provider delay={delayMilliseconds}>
      <BaseTooltip.Root>
        <BaseTooltip.Trigger render={children} />

        <BaseTooltip.Portal container={portalContainer}>
          <BaseTooltip.Positioner side={side} sideOffset={8} collisionPadding={8} className="z-50">
            <BaseTooltip.Popup
              aria-hidden
              className={`flux-glass rounded-lg px-2 py-1 text-xs font-medium text-white shadow-lg ${POPUP_MOTION}`}
            >
              {label}
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  );
};

Tooltip.displayName = 'Tooltip';

export { Tooltip, DELAY_MILLISECONDS };
