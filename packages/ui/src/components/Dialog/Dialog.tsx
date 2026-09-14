import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '@ValenceUI/cn';
import { usePortalContainer } from '@ValenceUI/usePortalContainer';
import { coverPage } from '@ValenceUI/pageCover';
import { companionContext } from './companionContext';
import type { CompanionSlot } from './companionContext';
import type { DialogProps, DialogSize } from './Dialog.types';

const OVERLAY_MOTION = [
  'data-open:animate-in data-open:fade-in-0',
  'data-closed:animate-out data-closed:fade-out-0',
  'duration-[var(--duration-base)] ease-[var(--ease-out)]',
  'data-closed:duration-[var(--duration-leaving)] data-closed:ease-[var(--ease-in-out)]',
  'motion-reduce:duration-[var(--duration-instant)]',
].join(' ');

const PANEL_MOTION = [
  'data-open:animate-in data-closed:animate-out',
  'data-open:fade-in-0 data-closed:fade-out-0',
  'max-sm:data-open:slide-in-from-bottom-8 max-sm:data-closed:slide-out-to-bottom-8',
  'sm:data-open:zoom-in-95 sm:data-closed:zoom-out-95',
  'duration-[var(--duration-base)] ease-[var(--ease-out)]',
  'data-closed:duration-[var(--duration-leaving)] data-closed:ease-[var(--ease-in-out)]',
  'motion-reduce:duration-[var(--duration-instant)]',
].join(' ');

const STANDING = [
  'fixed inset-x-0 top-0 bottom-0 z-50 text-text',
  'sm:inset-x-auto sm:inset-y-auto sm:top-1/2 sm:left-1/2 sm:max-h-[85vh]',
  'sm:-translate-x-1/2 sm:-translate-y-1/2',
  'outline-none',
].join(' ');

const PANEL = [
  'flex flex-col overflow-hidden rounded-none',
  'valence-float',
  'sm:w-[min(42rem,92vw)] sm:rounded-2xl',
].join(' ');

const ROW = ['flex flex-col gap-3 overflow-y-auto', 'sm:flex-row sm:gap-0 sm:overflow-hidden'].join(
  ' ',
);

const BESIDE = [
  'flex min-h-0 shrink-0 flex-col overflow-hidden rounded-none',
  'valence-float',
  'sm:rounded-2xl',
].join(' ');

const BESIDE_WIDTH = 'min(26rem, 40vw)';

const BESIDE_GAP = '1rem';

const SIZE_CLASSES: Record<DialogSize, string> = {
  default: '',
  stage: cn(
    'h-full w-full max-w-none rounded-none p-0',
    'sm:h-[88vh] sm:max-h-[88vh] sm:w-[min(60rem,94vw)] sm:rounded-2xl',
  ),
};

/**
 * The one place a dialog is written. Holds the panel, the overlay, the focus trap and the escape
 * handling, so a caller supplies only what is inside. Every dialog in Valence is this or composes it; a
 * raw dialog element elsewhere is lint-banned.
 *
 * The overlay sits at the same height as the panel rather than below it, so that what decides the
 * order of two open dialogs is which was opened last rather than which rule happens to be higher. An
 * overlay lower than the panel dimmed the page a second time and left the dialog it opened over
 * untouched — the one thing it was meant to put behind.
 *
 * It enters from the bottom on a phone and from its own centre on anything larger, because a sheet
 * is what a small screen expects and a panel is what a large one does. Both leave the way they
 * arrived, so dismissing reads as the reverse of opening rather than as a second, unrelated event.
 *
 * Leaving is eased differently to arriving, which is the difference between an animation that runs
 * and one that can be seen. `--ease-out` is deliberately front-loaded so that a thing arriving feels
 * immediate; measured on the way out it put the panel at half opacity three milliseconds in and at a
 * tenth of it after thirty, spending the rest of its time invisible. That reads as vanishing however
 * long the duration says it lasts. On `--ease-in-out` the panel holds its shape for the first third
 * and is half gone at fifty milliseconds, which is the same length of animation and a visible one.
 *
 * A dialog opened from inside a dialog stands beside it rather than over it, where anything within
 * asks for that. The panel and its companion are one row held at a fixed width, so the panel narrows
 * by exactly what the companion takes and neither is positioned by hand.
 *
 * What stands beside it is carried here rather than copied: this holds the column, and whatever
 * asked for it draws into that column from where it already lives. A copy would be taken once, and a
 * form that changed afterwards — a role granted, a name typed — would go on showing what it held
 * when it opened.
 *
 * Side by side needs a side: below the small breakpoint the two are stacked in the one sheet, since
 * a phone has no room to put anything next to anything.
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
  const prefersReducedMotion = useReducedMotion();
  const [claimed, setClaimed] = useState<string[]>([]);
  const [column, setColumn] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    return coverPage();
  }, [isOpen]);

  const claim = useCallback((id: string) => {
    setClaimed((standing) => (standing.includes(id) ? standing : [...standing, id]));
  }, []);

  const release = useCallback((id: string) => {
    setClaimed((standing) =>
      standing.includes(id) ? standing.filter((one) => one !== id) : standing,
    );
  }, []);

  const current = claimed.at(-1) ?? null;

  const holdColumn = useCallback((node: HTMLElement | null) => {
    setColumn((standing) => (node === null ? standing : node));
  }, []);

  useEffect(() => {
    if (current === null) {
      setColumn(null);
    }
  }, [current]);

  const slot = useMemo<CompanionSlot>(
    () => ({ claim, release, current, column }),
    [claim, release, current, column],
  );

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
          className={cn('fixed inset-0 z-50 bg-shade/55 backdrop-blur-md', OVERLAY_MOTION)}
        />

        <BaseDialog.Popup
          ref={panelRef}
          aria-label={label}
          initialFocus={panelRef}
          data-slot="dialog-content"
          className={cn(
            STANDING,
            'sm:w-[min(42rem,92vw)]',
            ROW,
            PANEL_MOTION,
            SIZE_CLASSES[size],
            className,
          )}
        >
          <companionContext.Provider value={slot}>
            <div className={cn(PANEL, 'min-h-0 min-w-0 flex-1 sm:w-auto')}>{children}</div>

            <AnimatePresence initial={false} mode="wait">
              {current === null ? null : (
                <motion.div
                  key={current}
                  ref={holdColumn}
                  data-slot="dialog-companion"
                  initial={{ width: 0, marginLeft: 0, opacity: 0 }}
                  animate={{ width: BESIDE_WIDTH, marginLeft: BESIDE_GAP, opacity: 1 }}
                  exit={{ width: 0, marginLeft: 0, opacity: 0 }}
                  transition={
                    prefersReducedMotion === true
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 420, damping: 40 }
                  }
                  className={BESIDE}
                />
              )}
            </AnimatePresence>
          </companionContext.Provider>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
};

Dialog.displayName = 'Dialog';

export { Dialog };
