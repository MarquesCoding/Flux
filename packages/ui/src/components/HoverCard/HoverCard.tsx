import { PreviewCard } from '@base-ui/react/preview-card';
import { cn } from '@FluxUI/cn';
import { usePortalContainer } from '@FluxUI/usePortalContainer';
import type { HoverCardProps } from './HoverCard.types';

const POPUP_MOTION = [
  'origin-[var(--transform-origin)] transition-[transform,opacity]',
  'duration-[var(--duration-base)] ease-[var(--ease-soft)]',
  'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
  'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
  'motion-reduce:transition-opacity',
].join(' ');

/**
 * Shows more about whatever the pointer has stopped on, without anything being pressed — a
 * description, a cast list, what a figure is measured over. Appears after a pause rather than at
 * once, so crossing a row of things does not flash a card on each of them.
 *
 * @param children - The thing being hovered.
 * @param detail - What to show about it.
 * @param side - Which side of the thing to appear on.
 * @param align - Which edge of the thing the card lines up with.
 * @param className - Extra classes for the caller's own layout.
 */
const HoverCard = ({
  children,
  detail,
  side = 'top',
  align = 'end',
  className,
}: HoverCardProps) => {
  const portalContainer = usePortalContainer();

  return (
    <PreviewCard.Root>
      <PreviewCard.Trigger
        render={<span className="inline-flex cursor-default items-center gap-2" />}
      >
        {children}
      </PreviewCard.Trigger>

      <PreviewCard.Portal container={portalContainer}>
        <PreviewCard.Positioner side={side} align={align} sideOffset={8} className="z-50">
          <PreviewCard.Popup
            className={cn(
              'flux-glass w-72 rounded-xl p-4 text-sm text-text',
              POPUP_MOTION,
              className,
            )}
          >
            {detail}
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
};

HoverCard.displayName = 'HoverCard';

export { HoverCard };
