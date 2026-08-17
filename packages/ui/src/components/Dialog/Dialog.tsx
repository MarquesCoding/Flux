import * as RadixDialog from '@radix-ui/react-dialog';
import { cn } from '@FluxUI/cn';
import { OVERLAY_MOTION } from '@FluxUI/animations/motion';
import { usePortalContainer } from '@FluxUI/usePortalContainer';
import type { DialogProps, DialogSize } from './Dialog.types';

const PANEL_MOTION = [
  'data-[state=open]:animate-in data-[state=closed]:animate-out',
  'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
  'max-sm:data-[state=open]:slide-in-from-bottom-8 max-sm:data-[state=closed]:slide-out-to-bottom-8',
  'sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95',
  'duration-[var(--duration-base)] ease-[var(--ease-out)]',
  'motion-reduce:animate-none',
].join(' ');

const SIZE_CLASSES: Record<DialogSize, string> = {
  default: '',
  stage: cn(
    'h-full w-full max-w-none rounded-none p-0',
    'sm:h-auto sm:min-h-[68vh] sm:max-h-[92vh] sm:w-[min(60rem,94vw)] sm:rounded-lg',
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
 * @param label - What the dialog is, read out on opening.
 * @param isOpen - Whether it is showing.
 * @param onClose - Told when it was dismissed, by the overlay, the escape key or a close button.
 * @param children - What the dialog holds, usually a title, some content and a footer.
 * @param size - How large it stands. A stage fills the screen on a phone and takes the same broad
 *   panel on anything larger, with a floor as well as a ceiling so that the three dialogs a library
 *   opens are the same size whatever they happen to hold.
 * @param className - Extra classes for the caller's own layout.
 */
const Dialog = ({ label, isOpen, onClose, children, size = 'default', className }: DialogProps) => {
  const portalContainer = usePortalContainer();

  return (
    <RadixDialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <RadixDialog.Portal {...(portalContainer === undefined ? {} : { container: portalContainer })}>
        <RadixDialog.Overlay
          data-slot="dialog-overlay"
          className={cn('fixed inset-0 z-40 bg-black/70 backdrop-blur-sm', OVERLAY_MOTION)}
        />

        <RadixDialog.Content
          aria-label={label}
          data-slot="dialog-content"
          className={cn(
            'fixed inset-x-0 bottom-0 top-0 z-50 flex flex-col overflow-hidden bg-card text-card-foreground',
            'sm:inset-x-auto sm:inset-y-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85vh]',
            'sm:w-[min(42rem,92vw)] sm:-translate-x-1/2 sm:-translate-y-1/2',
            'sm:rounded-lg sm:border sm:border-[var(--surface-line)] sm:shadow-[var(--shadow-overlay)]',
            'outline-none',
            PANEL_MOTION,
            SIZE_CLASSES[size],
            className,
          )}
        >
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};

Dialog.displayName = 'Dialog';

export { Dialog };
