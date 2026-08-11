import type { ActiveSession } from '@FluxWeb/admin/fetchAdmin'

type SessionStatsDialogProps = {
  session: ActiveSession
  isOpen: boolean
  onClose: () => void
}

export type { SessionStatsDialogProps }
