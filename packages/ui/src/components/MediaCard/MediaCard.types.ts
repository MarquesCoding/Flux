type MediaCardProps = {
  title: string
  subtitle: string
  badges?: string[]
  posterUrl?: string
  onSelect: () => void
  className?: string
}

export type { MediaCardProps }
