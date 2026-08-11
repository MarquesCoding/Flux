import { Dialog as BaseDialog } from '@base-ui-components/react/dialog';
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
  // Out of the way quickly and in with a settle: arriving is worth watching
  // and leaving is not. The curve decelerates hard rather than easing evenly,
  // which is what makes a panel look like it has weight instead of like a
  // rectangle whose opacity is being changed.
  //
  // Every property that actually moves is named. Tailwind writes a shift and a
  // scale as the `translate` and `scale` properties rather than into
  // `transform`, so a transition that only knows about `transform` transitions
  // nothing: the panel snapped into place and only its opacity was ever
  // animated.
  'transition-[opacity,transform,translate,scale] duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
  'data-[ending-style]:duration-150 data-[ending-style]:ease-in',
  'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
  // Each width animates the property the other is using for layout: a phone
  // slides, and a desktop is already translated to sit in the middle, so it
  // scales instead.
  'max-sm:data-[starting-style]:translate-y-10 max-sm:data-[ending-style]:translate-y-6',
  'sm:data-[starting-style]:scale-[0.92] sm:data-[ending-style]:scale-[0.98]',
  'motion-reduce:transition-opacity',
  'motion-reduce:max-sm:data-[starting-style]:translate-y-0',
  'motion-reduce:max-sm:data-[ending-style]:translate-y-0',
  'motion-reduce:sm:data-[starting-style]:scale-100',
  'motion-reduce:sm:data-[ending-style]:scale-100',
].join(' ');

const BACKDROP_MOTION = [
  // Ahead of the panel on the way in and behind it on the way out, so the page
  // is already dimmed when the panel lands and still dim while it leaves.
  'transition-opacity duration-200 ease-out data-[ending-style]:duration-200',
  'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
].join(' ');

/**
 * A panel over the page.
 *
 * Built on the Base UI dialog so focus is trapped and restored, escape closes,
 * the page behind is inert and the whole thing is announced properly — none of
 * which a positioned div gets right by accident.
 */
const Dialog = ({ label, isOpen, onClose, children, className }: DialogProps) => (
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
        className={cn(
          'fixed inset-x-0 bottom-0 top-0 z-50 overflow-y-auto bg-surface text-text',
          'sm:inset-x-auto sm:inset-y-auto sm:left-1/2 sm:top-1/2 sm:max-h-[90vh]',
          'sm:w-[min(56rem,92vw)] sm:-translate-x-1/2 sm:-translate-y-1/2',
          'sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl',
          POPUP_MOTION,
          className,
        )}
      >
        {children}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  </BaseDialog.Root>
);

Dialog.displayName = 'Dialog';

export { Dialog };
