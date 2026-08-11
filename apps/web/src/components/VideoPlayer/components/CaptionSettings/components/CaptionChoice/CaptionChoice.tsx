import { Button } from '@FluxUI/Button'
import type { CaptionChoiceProps } from './CaptionChoice.types'

/**
 * One decision about how captions look, laid out flat.
 *
 * A row of the choices rather than a menu holding them. This is already a page
 * inside a panel, and opening a second panel out of it to pick between four
 * words puts a viewer two layers deep to change a font — where the four words
 * would have fitted on the line they were reading.
 *
 * Flat also means the answer is visible without asking: somebody comparing
 * "Outline" against "Drop shadow" can see both, and the preview above changes
 * as they press.
 */
const CaptionChoice = ({ label, options, selectedId, onSelect }: CaptionChoiceProps) => (
  <fieldset className="flex flex-col gap-2">
    <legend className="mb-2">{label}</legend>

    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <Button
          key={option.id}
          size="sm"
          isPill
          // Said rather than only shown. A row of these is a set of choices
          // where one is in force, and a reader who cannot see which is filled
          // deserves to be told which is pressed.
          aria-pressed={option.id === selectedId}
          variant={option.id === selectedId ? 'glossy' : 'ghost'}
          onClick={() => {
            onSelect(option.id)
          }}
        >
          {option.label}
        </Button>
      ))}
    </div>
  </fieldset>
)

CaptionChoice.displayName = 'CaptionChoice'

export { CaptionChoice }
