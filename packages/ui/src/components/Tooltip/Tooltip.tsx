import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import { usePortalContainer } from '@FluxUI/usePortalContainer';
import type { TooltipProps } from './Tooltip.types';

/**
 * How long a pointer must rest before a name appears.
 *
 * Long enough that crossing a bar of eight controls names none of them, short
 * enough that stopping on one is answered rather than waited on.
 */
const DELAY_MILLISECONDS = 450;

/**
 * How it arrives and leaves.
 *
 * Out of the control it belongs to: it grows from the edge nearest the thing
 * it is naming and settles a few pixels away, which is what makes it read as
 * that control speaking rather than as a box appearing nearby. Quick on both
 * counts — a name is worth no more of somebody's attention than it takes to
 * read, and the delay before it has already had their patience.
 *
 * Every property that moves is named. Tailwind writes a shift and a scale as
 * the `translate` and `scale` properties rather than into `transform`, so a
 * transition that only knows about `transform` transitions nothing.
 */
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
 *
 * Every icon in this interface has an accessible name already — that is what
 * makes it usable without sight. This is the same name, for the person who can
 * see the icon and still cannot tell what it does, which is most people
 * meeting a row of glyphs for the first time.
 *
 * It does not replace the label. Both come from the same word, so a control
 * cannot end up called one thing by a screen reader and another by a tooltip.
 *
 * Kept out of the way of the pointer and out of the accessibility tree: a
 * tooltip that announces itself reads the name of the control twice.
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
