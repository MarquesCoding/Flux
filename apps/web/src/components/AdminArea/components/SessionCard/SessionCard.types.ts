import type { ActiveSession } from '@FluxWeb/admin/fetchAdmin'

type SessionCardProps = {
  session: ActiveSession
  /**
   * Whether an admin action is in flight for this card, so its buttons show
   * their own loading state rather than the whole grid appearing to hang.
   */
  isBusy: boolean
  onStop: () => void
  onPause: () => void
  onResume: () => void
}

export type { SessionCardProps }
