import { useContext, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { Dialog } from '@ValenceUI/Dialog';
import { companionContext } from '@ValenceUI/Dialog.companionContext';
import type { DialogCompanionProps } from './DialogCompanion.types';

/**
 * A panel that stands beside the dialog it was opened from rather than over it. Written where the
 * thing it explains lives — a row deep inside a panel — and drawn at the edge of the dialog that row
 * sits in, because a second dialog laid over the first hides the very thing it was opened to explain.
 *
 * It is carried to the column rather than copied into it. A copy is taken once, so a form that
 * changed — a role granted, a name typed — went on showing what it held at the moment it opened.
 * Sent through a portal, what is drawn beside the dialog is the same thing the panel is rendering,
 * so it answers to its own state as it always did and simply appears somewhere else.
 *
 * Opened from somewhere with no dialog above it, it is an ordinary dialog. A panel is only a
 * companion to something — there is nothing for it to stand beside on a bare page — and a control
 * that works inside the admin dialog must still work on a screen that is not one.
 *
 * @param label - What the panel is, read out when it stands alone.
 * @param isOpen - Whether it is showing.
 * @param onClose - Told when it was dismissed.
 * @param children - The panel's content, usually a title and some content.
 */
const DialogCompanion = ({ label, isOpen, onClose, children }: DialogCompanionProps) => {
  const slot = useContext(companionContext);
  const id = useId();

  useEffect(() => {
    if (slot === null) {
      return;
    }

    if (!isOpen) {
      slot.release(id);

      return;
    }

    slot.claim(id);

    return () => {
      slot.release(id);
    };
  }, [slot, isOpen, id]);

  if (slot === null) {
    return (
      <Dialog label={label} isOpen={isOpen} onClose={onClose}>
        {children}
      </Dialog>
    );
  }

  if (!isOpen || slot.current !== id || slot.column === null) {
    return null;
  }

  return createPortal(children, slot.column);
};

DialogCompanion.displayName = 'DialogCompanion';

export { DialogCompanion };
