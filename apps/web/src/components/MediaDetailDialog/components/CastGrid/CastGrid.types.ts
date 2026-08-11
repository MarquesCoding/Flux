type CastMember = {
  name: string
  role: string
  imageUrl: string | null
}

type CastGridProps = {
  members: CastMember[]
}

export type { CastGridProps, CastMember }
