import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile'

type ProfilePickerProps = {
  profiles: ViewerProfile[]
  onChoose: (profile: ViewerProfile) => void
  /**
   * Called when somebody is added or removed, so the list can be read again.
   */
  onChanged: () => void
  /**
   * Whether the picker offers to change the account rather than only use it.
   *
   * Off on the way in, where the only question is who is watching. On when it
   * is opened deliberately from the account page.
   */
  isEditable?: boolean
}

export type { ProfilePickerProps }
