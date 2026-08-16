import { useRef } from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { cn } from '@FluxUI/cn';
import { usePortalContainer } from '@FluxUI/usePortalContainer';
import type { DialogProps, DialogSize } from './Dialog.types';

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

const SIZE_CLASSES: Record<DialogSize, string> = {
  default: '',
  stage: cn(
    'h-full w-full max-w-none rounded-none p-0',
    'sm:h-auto sm:min-h-[68vh] sm:max-h-[92vh] sm:w-[min(60rem,94vw)] sm:rounded-3xl',
  ),
};

/**
 * The one place a `<dialog>` is written. Holds the panel, the backdrop, the focus trap and the
 * escape handling, so a caller supplies only what is inside. Every dialog in Flux is this or
 * composes it; a raw dialog element elsewhere is lint-banned.
 *
 * @param label - What the dialog is, read out on opening.
 * @param isOpen - Whether it is showing.
 * @param onClose - Told when it was dismissed, by the backdrop, the escape key or a close button.
 * @param children - What the dialog holds, usually a title, some content and a footer.
 * @param size - How large it stands. A stage fills the screen on a phone and takes the same broad
 *   panel on anything larger, with a floor as well as a ceiling so that the three dialogs a library
 *   opens are the same size whatever they happen to hold.
 * @param className - Extra classes for the caller's own layout.
 */
const Dialog = ({ label, isOpen, onClose, children, size = 'default', className }: DialogProps) => {
  const portalContainer = usePortalContainer();

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
      <BaseDialog.Portal container={portalContainer}>
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
