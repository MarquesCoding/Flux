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
 * More about the thing under the pointer, without pressing anything.
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
