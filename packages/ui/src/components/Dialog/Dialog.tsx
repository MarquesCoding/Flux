import { useRef } from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { cn } from '@FluxUI/cn';
import { usePortalContainer } from '@FluxUI/usePortalContainer';
import type { DialogProps, DialogSize } from './Dialog.types';

const OVERLAY_MOTION = [
  'data-open:animate-in data-open:fade-in-0',
  'data-closed:animate-out data-closed:fade-out-0',
  'duration-[var(--duration-base)] ease-[var(--ease-out)]',
  'data-closed:duration-[var(--duration-leaving)]',
  'motion-reduce:duration-[var(--duration-instant)]',
].join(' ');

const PANEL_MOTION = [
  'data-open:animate-in data-closed:animate-out',
  'data-open:fade-in-0 data-closed:fade-out-0',
  'max-sm:data-open:slide-in-from-bottom-8 max-sm:data-closed:slide-out-to-bottom-8',
  'sm:data-open:zoom-in-95 sm:data-closed:zoom-out-95',
  'duration-[var(--duration-base)] ease-[var(--ease-out)]',
  'data-closed:duration-[var(--duration-leaving)]',
  'motion-reduce:duration-[var(--duration-instant)]',
].join(' ');

const SIZE_CLASSES: Record<DialogSize, string> = {
  default: '',
  stage: cn(
    'h-full w-full max-w-none rounded-none p-0',
    'sm:h-[88vh] sm:max-h-[88vh] sm:w-[min(60rem,94vw)] sm:rounded-lg',
  ),
};

/**
 * The one place a dialog is written. Holds the panel, the overlay, the focus trap and the escape
 * handling, so a caller supplies only what is inside. Every dialog in Flux is this or composes it; a
 * raw dialog element elsewhere is lint-banned.
 *
 * It enters from the bottom on a phone and from its own centre on anything larger, because a sheet
 * is what a small screen expects and a panel is what a large one does. Both leave the way they
 * arrived, so dismissing reads as the reverse of opening rather than as a second, unrelated event.
 *
 * The leaving half of that is why this is built on Base UI rather than Radix. The markup was the
 * same under both and the stylesheet was verified complete, but a Radix panel unmounted the instant
 * it was dismissed and never played its exit. Base UI holds the element through the animation and
 * says so with `data-closed`, which is what these classes are hung on.
 *
 * Closing hands focus back only to a keyboard, which is the same distinction `:focus-visible`
 * draws. Returning it after a click puts a focus ring on whatever was clicked to open the dialog —
 * a media card left outlined after it was dismissed — and scrolls that element back into view,
 * neither of which a pointer asked for. A keyboard has nowhere else to go, so it still gets it.
 *
 * Opening puts focus on the panel rather than on the first control inside it. Landing on a control
 * draws a focus ring around whatever happens to be first — the favourite button, an icon — which
 * reads as though the dialog has already chosen something on the viewer's behalf. The panel takes
 * the focus instead, so the keyboard still works and nothing appears pre-selected.
 *
 * It follows the browser into fullscreen. A portal defaults to the body, which the browser paints
 * underneath the fullscreen element, so a dialog raised over the player would otherwise open where
 * nobody could see it.
 *
 * @param label - What the dialog is, read out on opening.
 * @param isOpen - Whether it is showing.
 * @param onClose - Told when it was dismissed, by the overlay, the escape key or a close button.
 * @param children - What the dialog holds, usually a title, some content and a footer.
 * @param size - How large it stands. A stage fills the screen on a phone and takes the same broad
 *   panel on anything larger. Its height is fixed rather than bounded, because a floor and a ceiling
 *   only agree when the content reaches one of them.
 * @param className - Extra classes for the caller's own layout.
 */
const Dialog = ({ label, isOpen, onClose, children, size = 'default', className }: DialogProps) => {
  const portalContainer = usePortalContainer();
  const panelRef = useRef<HTMLDivElement>(null);

  return (
    <BaseDialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <BaseDialog.Portal {...(portalContainer === undefined ? {} : { container: portalContainer })}>
        <BaseDialog.Backdrop
          data-slot="dialog-overlay"
          className={cn('fixed inset-0 z-40 bg-black/70 backdrop-blur-sm', OVERLAY_MOTION)}
        />

        <BaseDialog.Popup
          ref={panelRef}
          aria-label={label}
          initialFocus={panelRef}
          finalFocus={(closeType) => closeType === 'keyboard'}
          data-slot="dialog-content"
          className={cn(
            'fixed inset-x-0 top-0 bottom-0 z-50 flex flex-col overflow-hidden bg-card text-card-foreground',
            'sm:inset-x-auto sm:inset-y-auto sm:top-1/2 sm:left-1/2 sm:max-h-[85vh]',
            'sm:w-[min(42rem,92vw)] sm:-translate-x-1/2 sm:-translate-y-1/2',
            'sm:rounded-lg sm:border sm:border-[var(--surface-line)] sm:shadow-[var(--shadow-overlay)]',
            'outline-none',
            PANEL_MOTION,
            SIZE_CLASSES[size],
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
