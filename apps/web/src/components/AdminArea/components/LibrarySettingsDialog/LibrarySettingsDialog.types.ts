import type { Library } from '@FluxContracts/schemas/Library'

type LibrarySettingsDialogProps = {
  library: Library | null
  isOpen: boolean
  onClose: () => void
  onUpdated: (library: Library) => void
  /**
   * Asks the caller to queue preview regeneration for a library.
   *
   * Fire-and-forget from this dialog's point of view: the caller is
   * responsible for tracking and showing progress, the same way it already
   * does for a scan, so this dialog can close immediately rather than
   * blocking on a job that can take a while.
   */
  onRegenerate: (libraryId: string) => void
}

export type { LibrarySettingsDialogProps }
