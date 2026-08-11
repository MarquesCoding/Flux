import type { ReactNode } from 'react'

type SettingsChoice = {
  id: string
  label: string
  detail?: string
}

/**
 * A row that opens a list of choices.
 *
 * The current one is shown on the row itself, so the panel answers what
 * everything is set to without being opened item by item.
 */
type SettingsChoiceRow = {
  kind: 'choice'
  id: string
  label: string
  icon: ReactNode
  choices: SettingsChoice[]
  selectedId: string
  onSelect: (id: string) => void
}

/**
 * A row that is on or off.
 */
type SettingsToggleRow = {
  kind: 'toggle'
  id: string
  label: string
  icon: ReactNode
  isOn: boolean
  onToggle: () => void
}

/**
 * A row that does something rather than holding a value.
 *
 * For the settings that need a screen of their own — caption appearance is a
 * dozen controls, not a list of five things.
 */
type SettingsActionRow = {
  kind: 'action'
  id: string
  label: string
  icon: ReactNode
  detail?: string
  onSelect: () => void
}

/**
 * A row carrying a control of its own.
 *
 * For what is adjusted by feel rather than picked: nudging subtitles into
 * time means pressing, watching, and pressing again, which a row that closes
 * the panel makes impossible.
 */
type SettingsCustomRow = {
  kind: 'custom'
  id: string
  label: string
  icon: ReactNode
  detail?: string
  control: ReactNode
}

type SettingsRow = SettingsChoiceRow | SettingsToggleRow | SettingsActionRow | SettingsCustomRow

type SettingsMenuProps = {
  label: string
  trigger: ReactNode
  rows: SettingsRow[]
  isDisabled?: boolean
  className?: string
}

export type {
  SettingsActionRow,
  SettingsChoice,
  SettingsChoiceRow,
  SettingsCustomRow,
  SettingsMenuProps,
  SettingsRow,
  SettingsToggleRow,
}
