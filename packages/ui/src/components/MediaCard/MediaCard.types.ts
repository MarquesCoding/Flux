import type { ReactNode } from 'react'

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
  /**
   * The line above the title, smaller and in capitals.
   *
   * What is being offered, where the title is what makes it recognisable: an
   * episode over the show it belongs to. Films have nothing here.
   */
  eyebrow?: ReactNode
  /**
   * The line below the title.
   *
   * Anything renderable rather than a string: what places an item is a list of
   * facts, and one of them is a rating, which is a mark as well as a number.
   */
  subtitle: ReactNode
  badges?: string[]
  imageUrl?: string
  shape?: MediaCardShape
  emphasis?: MediaCardEmphasis
  /**
   * How far through this item the viewer is, between nothing and everything.
   *
   * Drawn as a line across the foot of the artwork. Absent means unwatched,
   * which is different from nought: a bar sitting at zero on every unwatched
   * item is a row of noise.
   */
  watchedFraction?: number
  onSelect: () => void
  /**
   * Whether the card stays where it is put.
   *
   * A card in a row lifts towards the pointer, which is what makes a row feel
   * like a shelf. A card in a list inside a panel is a line of a list, and a
   * line that jumps when the pointer crosses it makes the list look unstable.
   */
  isStill?: boolean
  className?: string
}

export type { MediaCardEmphasis, MediaCardProps, MediaCardShape }
