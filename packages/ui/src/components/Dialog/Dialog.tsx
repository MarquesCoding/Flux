import { Dialog as BaseDialog } from '@base-ui-components/react/dialog'
import cnModule from '@FluxUI/cn'
import type { DialogProps } from './Dialog.types'

const { cn } = cnModule

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
        onClose()
      }
    }}
  >
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />

      <BaseDialog.Popup
        aria-label={label}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(56rem,92vw)] -translate-x-1/2',
          '-translate-y-1/2 overflow-y-auto rounded-2xl border border-border',
          'bg-surface text-text shadow-2xl',
          className,
        )}
      >
        {children}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  </BaseDialog.Root>
)

Dialog.displayName = 'Dialog'

export default { Dialog }
