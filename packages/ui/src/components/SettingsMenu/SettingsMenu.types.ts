import type { ReactNode } from 'react';

type SettingsChoice = {
  id: string;
  label: string;
  detail?: string;
};

/**
 * A row that opens a list of choices.
 *
 * The current one is shown on the row itself, so the panel answers what
 * everything is set to without being opened item by item.
 */
type SettingsChoiceRow = {
  kind: 'choice';
  id: string;
  label: string;
  icon: ReactNode;
  choices: SettingsChoice[];
  selectedId: string;
  onSelect: (id: string) => void;
};

/**
 * A row that is on or off.
 */
type SettingsToggleRow = {
  kind: 'toggle';
  id: string;
  label: string;
  icon: ReactNode;
  isOn: boolean;
  onToggle: () => void;
};

/**
 * A row that does something rather than holding a value.
 *
 * For the settings that need a screen of their own — caption appearance is a
 * dozen controls, not a list of five things.
 */
type SettingsActionRow = {
  kind: 'action';
  id: string;
  label: string;
  icon: ReactNode;
  detail?: string;
  onSelect: () => void;
};

/**
 * A row carrying a control of its own.
 *
 * For what is adjusted by feel rather than picked: nudging subtitles into
 * time means pressing, watching, and pressing again, which a row that closes
 * the panel makes impossible.
 */
type SettingsCustomRow = {
  kind: 'custom';
  id: string;
  label: string;
  icon: ReactNode;
  detail?: string;
  control: ReactNode;
};

/**
 * A row that opens a screen of its own.
 *
 * For a setting that is a dozen controls rather than a list of five things:
 * caption appearance is a page, and a page inside the panel is one less thing
 * covering the film than a page floating over it.
 */
type SettingsPanelRow = {
  kind: 'panel';
  id: string;
  label: string;
  icon: ReactNode;
  detail?: string;
  content: ReactNode;
};

type SettingsRow =
  SettingsChoiceRow | SettingsToggleRow | SettingsActionRow | SettingsCustomRow | SettingsPanelRow;

type SettingsMenuProps = {
  label: string;
  trigger: ReactNode;
  /**
   * The trigger while the panel is open.
   *
   * A control that is doing something should look like it: the filled form of
   * the same mark, so it reads as the same control rather than a different
   * one. Left out where the mark has no filled form.
   */
  triggerWhenOpen?: ReactNode;
  rows: SettingsRow[];
  /**
   * Says when the panel opens and closes.
   *
   * What is underneath may need to stay put while it is open — a bar that
   * fades out from under an open menu takes the menu with it.
   */
  onOpenChange?: (isOpen: boolean) => void;
  isDisabled?: boolean;
  className?: string;
};

export type {
  SettingsActionRow,
  SettingsChoice,
  SettingsChoiceRow,
  SettingsCustomRow,
  SettingsMenuProps,
  SettingsPanelRow,
  SettingsRow,
  SettingsToggleRow,
};
