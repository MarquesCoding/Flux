import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile'

type ProfileFaceProps = {
  profile: ViewerProfile
  /**
   * A picture chosen but not yet uploaded, drawn in place of the saved one.
   *
   * Somebody picking a photograph should see it before deciding to keep it.
   */
  pending?: File | null
  className?: string
}

export type { ProfileFaceProps }
