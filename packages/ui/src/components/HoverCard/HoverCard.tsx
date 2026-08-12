import { PreviewCard } from '@base-ui/react/preview-card';
import { cn } from '@FluxUI/cn';
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
 *
 * For detail that would crowd the row it belongs to — which file a job is on,
 * what a figure is made of. A table can then say the short version in its
 * column and keep the long version a rest away, rather than choosing between
 * a cramped cell and a dialog nobody opens.
 *
 * Unlike a tooltip this can be pointed at and read from, so it may hold
 * several lines and its own structure.
 */
const HoverCard = ({
  children,
  detail,
  side = 'top',
  align = 'end',
  className,
}: HoverCardProps) => (
  <PreviewCard.Root>
    <PreviewCard.Trigger
      render={<span className="inline-flex cursor-default items-center gap-2" />}
    >
      {children}
    </PreviewCard.Trigger>

    <PreviewCard.Portal>
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

HoverCard.displayName = 'HoverCard';

export { HoverCard };
