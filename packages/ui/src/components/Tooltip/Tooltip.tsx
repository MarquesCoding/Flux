import { Tooltip as BaseTooltip } from '@base-ui-components/react/tooltip'
import type { TooltipProps } from './Tooltip.types'

/**
 * How long a pointer must rest before a name appears.
 *
 * Long enough that crossing a bar of eight controls names none of them, short
 * enough that stopping on one is answered rather than waited on.
 */
const DELAY_MILLISECONDS = 450

/**
 * The name of a control, for the pointer that has stopped on it.
 *
 * Every icon in this interface has an accessible name already — that is what
 * makes it usable without sight. This is the same name, for the person who can
 * see the icon and still cannot tell what it does, which is most people
 * meeting a row of glyphs for the first time.
 *
 * It does not replace the label. Both come from the same word, so a control
 * cannot end up called one thing by a screen reader and another by a tooltip.
 *
 * Kept out of the way of the pointer and out of the accessibility tree: a
 * tooltip that announces itself reads the name of the control twice.
 */
const Tooltip = ({ label, children, side = 'top', isDisabled = false }: TooltipProps) => {
  if (isDisabled) {
    return children
  }

  return (
    <BaseTooltip.Provider delay={DELAY_MILLISECONDS}>
      <BaseTooltip.Root>
        {/* The control itself is the trigger, rather than a wrapper around
            it. A wrapper that takes up no space has no position either, and
            the panel hung off it opened in the corner of the page. */}
        <BaseTooltip.Trigger render={children} />

        <BaseTooltip.Portal>
          <BaseTooltip.Positioner side={side} sideOffset={8} collisionPadding={8} className="z-50">
            <BaseTooltip.Popup
              aria-hidden
              className="flux-glass rounded-lg px-2 py-1 text-xs font-medium text-white shadow-lg"
            >
              {label}
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  )
}

Tooltip.displayName = 'Tooltip'

export default { Tooltip, DELAY_MILLISECONDS }
