/**
 * How the artwork is shaped.
 *
 * A poster is the shape a film is printed in; a still is the shape a film is
 * shot in. A grid of stills reads as somewhere to browse rather than a shelf
 * to look through.
 */
type MediaCardShape = 'poster' | 'wide'

/**
 * How much of a row an item is entitled to.
 *
 * `lead` is for the item a row is really about — larger, with its title set
 * over the artwork. Everything being the same size is what makes a catalogue
 * feel like a spreadsheet.
 */
type MediaCardEmphasis = 'lead' | 'standard'

type MediaCardProps = {
  title: string
  subtitle: string
  badges?: string[]
  imageUrl?: string
  shape?: MediaCardShape
  emphasis?: MediaCardEmphasis
  onSelect: () => void
  className?: string
}

export type { MediaCardEmphasis, MediaCardProps, MediaCardShape }
