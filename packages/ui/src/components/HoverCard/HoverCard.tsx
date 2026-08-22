import * as RadixHoverCard from '@radix-ui/react-hover-card';
import { cn } from '@ValenceUI/cn';
import { POPUP_MOTION } from '@ValenceUI/animations/motion';
import { usePortalContainer } from '@ValenceUI/usePortalContainer';
import type { HoverCardProps } from './HoverCard.types';

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
    <RadixHoverCard.Root>
      <RadixHoverCard.Trigger asChild>
        <span className="inline-flex cursor-default items-center gap-2">{children}</span>
      </RadixHoverCard.Trigger>

      <RadixHoverCard.Portal
        {...(portalContainer === undefined ? {} : { container: portalContainer })}
      >
        <RadixHoverCard.Content
          side={side}
          align={align}
          sideOffset={8}
          data-slot="hover-card-content"
          className={cn(
            'z-50 flux-glass w-72 rounded-lg p-4 text-sm text-text outline-none',
            POPUP_MOTION,
            className,
          )}
        >
          {detail}
        </RadixHoverCard.Content>
      </RadixHoverCard.Portal>
    </RadixHoverCard.Root>
  );
};

HoverCard.displayName = 'HoverCard';

export { HoverCard };
