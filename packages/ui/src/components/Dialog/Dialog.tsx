import { useRef } from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { cn } from '@FluxUI/cn';
import type { DialogProps } from './Dialog.types';

/**
 * How the panel arrives and leaves.
 *
 * Driven by the state attributes Base UI sets rather than by a presence
 * wrapper, because Base UI already holds the element mounted until its
 * transition has finished. Anything animating this from the outside would be
 * racing it.
 *
 * A phone gets a sheet rising from the bottom edge, which is where a thumb
 * expects to have summoned it from. A desktop gets a panel settling into the
 * middle, since it has no edge the pointer came from.
 */
const POPUP_MOTION = [
  'transition-[opacity,transform,translate,scale] duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
  'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
  'max-sm:data-[starting-style]:translate-y-10 max-sm:data-[ending-style]:translate-y-10',
  'sm:data-[starting-style]:scale-[0.92] sm:data-[ending-style]:scale-[0.92]',
  'motion-reduce:transition-opacity',
  'motion-reduce:max-sm:data-[starting-style]:translate-y-0',
  'motion-reduce:max-sm:data-[ending-style]:translate-y-0',
  'motion-reduce:sm:data-[starting-style]:scale-100',
  'motion-reduce:sm:data-[ending-style]:scale-100',
].join(' ');

const BACKDROP_MOTION = [
  'transition-opacity duration-200 ease-out data-[ending-style]:duration-200',
  'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
].join(' ');

/**
 * A panel over the page.
 *
 * Built on the Base UI dialog so focus is trapped and restored, escape closes,
 * the page behind is inert and the whole thing is announced properly — none of
 * which a positioned div gets right by accident.
 *
 * Bounded rather than as tall as its contents: a column with a head, a middle
 * that scrolls and a foot, so a dialog holding two lines and one holding two
 * hundred are the same shape and their buttons are in the same place. Only the
 * middle moves, which is what `DialogContent` is for.
 *
 * Focus lands on the panel itself rather than on the first control inside it.
 * Opening a film put focus on the favourite button, and a tooltip opens on
 * focus, so the dialog arrived with a tooltip already showing for a control
 * nobody had pointed at. The panel is still focused, so focus is still trapped
 * and tabbing still starts at the top — it just does not press anything.
 */
const Dialog = ({ label, isOpen, onClose, children, className }: DialogProps) => {
  const panelRef = useRef<HTMLDivElement | null>(null);

  return (
    <BaseDialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop
          className={cn('fixed inset-0 z-40 bg-black/70 backdrop-blur-sm', BACKDROP_MOTION)}
        />

        <BaseDialog.Popup
          aria-label={label}
          ref={panelRef}
          initialFocus={panelRef}
          className={cn(
            'fixed inset-x-0 bottom-0 top-0 z-50 flex flex-col overflow-hidden bg-surface-raised text-text',
            'sm:inset-x-auto sm:inset-y-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85vh]',
            'sm:w-[min(42rem,92vw)] sm:-translate-x-1/2 sm:-translate-y-1/2',
            'sm:rounded-2xl sm:border sm:border-[var(--surface-line)] sm:shadow-2xl',
            POPUP_MOTION,
            className,
          )}
        >
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
};

Dialog.displayName = 'Dialog';

export { Dialog };
