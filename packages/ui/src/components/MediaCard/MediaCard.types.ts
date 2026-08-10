/**
 * How the artwork is shaped.
 *
 * A poster is the shape a film is printed in; a still is the shape a film is
 * shot in. A grid of stills reads as somewhere to browse rather than a shelf
 * to look through.
 */
type MediaCardShape = 'poster' | 'wide'

type MediaCardProps = {
  title: string
  subtitle: string
  badges?: string[]
  imageUrl?: string
  shape?: MediaCardShape
  onSelect: () => void
  className?: string
}

export type { MediaCardProps, MediaCardShape }
