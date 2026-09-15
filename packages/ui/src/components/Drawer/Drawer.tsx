import { Dialog } from '@ValenceUI/Dialog';
import type { DrawerProps } from './Drawer.types';

/**
 * A dialog that rises from the foot of the screen rather than standing at its centre, for content
 * worth stepping away from rather than stopping for. Composes `Dialog` at its `drawer` size rather
 * than wiring a modal a second time — see `Dialog` for the focus trapping, scroll locking and
 * fullscreen handling this inherits.
 *
 * @param label - What the drawer is, read out on opening.
 * @param isOpen - Whether it is showing.
 * @param onClose - Told when it was dismissed, by the overlay, the escape key or a close button.
 * @param children - What the drawer holds.
 * @param className - Extra classes for the caller's own layout.
 */
const Drawer = ({ label, isOpen, onClose, children, className }: DrawerProps) => (
  <Dialog
    label={label}
    isOpen={isOpen}
    onClose={onClose}
    size="drawer"
    {...(className === undefined ? {} : { className })}
  >
    {children}
  </Dialog>
);

Drawer.displayName = 'Drawer';

export { Drawer };
