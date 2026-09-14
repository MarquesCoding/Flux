import { useContext } from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { tooltipScopeContext } from '@ValenceUI/tooltipScopeContext';
import { cn } from '@ValenceUI/cn';
import { usePortalContainer } from '@ValenceUI/usePortalContainer';
import type { TooltipProps } from './Tooltip.types';

const DELAY_MILLISECONDS = 450;

const POPUP_MOTION = [
  'origin-[var(--radix-tooltip-content-transform-origin)]',
  'data-[state=delayed-open]:animate-in data-[state=closed]:animate-out',
  'data-[state=delayed-open]:fade-in-0 data-[state=closed]:fade-out-0',
  'data-[state=delayed-open]:zoom-in-95 data-[state=closed]:zoom-out-95',
  'duration-[var(--duration-fast)] ease-[var(--ease-out)]',
  'data-[state=closed]:duration-[var(--duration-leaving)]',
  'motion-reduce:duration-[var(--duration-instant)]',
].join(' ');

/**
 * Names a control for the pointer that has stopped on it, which is how a bar of icons stays
 * learnable. Wraps the control rather than sitting beside it, so the name is attached to the thing
 * it names for anybody reading the page rather than looking at it.
 *
 * It grows from the edge nearest the control rather than from its own middle, which is what makes it
 * read as belonging to that control rather than as a card that happened to appear.
 *
 * It is drawn in the page's colours turned over — ink for a ground, the ground for its words — and
 * flat, with no glass, edge or gloss. Those are what the controls themselves are made of, so a name
 * drawn with them looked like one more button hovering beside the first; a solid chip in the
 * opposite colours reads as a label on every surface and in either theme.
 *
 * The pause before it appears is there so that crossing a row of icons does not flash a name on each
 * one. But once any name is showing, the next is instant: the pause exists to establish that the
 * pointer has stopped, and that has already been established. Skipping it is what makes a bar of
 * icons feel fast rather than reluctant, and it needs the scope at the root — a scope per tooltip
 * means each one is the first one, and none of them ever skips.
 *
 * Where there is no scope it makes its own, so a tooltip works wherever it is put and merely loses
 * the shared pause. A component that throws depending on what is above it is not one anybody can
 * use with confidence.
 *
 * @param label - What the control does.
 * @param children - The control being named.
 * @param side - Which side of the control to appear on.
 * @param isDisabled - Whether to say nothing at all, for a control whose name is already written.
 * @param isOpen - Whether it is showing, for a caller that knows better than the pointer does. A
 *   tooltip dismisses itself the moment its control is pressed, which is right for a name and wrong
 *   for a figure being set: pressing a slider's handle is the start of choosing a value, not the end
 *   of reading its name. A caller that says so keeps it up for as long as it is true. Say it for the
 *   life of the tooltip or not at all — beginning uncontrolled and becoming controlled is a warning
 *   and a jump.
 * @param delayMilliseconds - How long the pointer rests before the name appears.
 */
const Tooltip = ({
  label,
  children,
  side = 'top',
  isDisabled = false,
  isOpen,
  delayMilliseconds = DELAY_MILLISECONDS,
}: TooltipProps) => {
  const portalContainer = usePortalContainer();
  const isScoped = useContext(tooltipScopeContext);

  if (isDisabled) {
    return children;
  }

  const named = (
    <RadixTooltip.Root
      delayDuration={delayMilliseconds}
      {...(isOpen === undefined ? {} : { open: isOpen })}
    >
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>

      <RadixTooltip.Portal
        {...(portalContainer === undefined ? {} : { container: portalContainer })}
      >
        <RadixTooltip.Content
          aria-hidden
          side={side}
          sideOffset={8}
          collisionPadding={8}
          data-slot="tooltip-content"
          className={cn(
            'z-50 max-w-[18rem] rounded-sm bg-text px-2.5 py-1.5 text-xs font-medium leading-4 text-balance text-surface',
            'shadow-[var(--shadow-raised)]',
            POPUP_MOTION,
          )}
        >
          {label}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );

  return isScoped ? (
    named
  ) : (
    <RadixTooltip.Provider delayDuration={delayMilliseconds}>{named}</RadixTooltip.Provider>
  );
};

Tooltip.displayName = 'Tooltip';

export { Tooltip };
