import type { ReactNode } from 'react';

type SettingsChoice = {
  id: string;
  label: string;
  detail?: string;
};

type SettingsChoiceRow = {
  kind: 'choice';
  id: string;
  label: string;
  icon: ReactNode;
  choices: SettingsChoice[];
  selectedId: string;
  onSelect: (id: string) => void;
};

type SettingsToggleRow = {
  kind: 'toggle';
  id: string;
  label: string;
  icon: ReactNode;
  isOn: boolean;
  onToggle: () => void;
};

type SettingsActionRow = {
  kind: 'action';
  id: string;
  label: string;
  icon: ReactNode;
  detail?: string;
  onSelect: () => void;
};

type SettingsCustomRow = {
  kind: 'custom';
  id: string;
  label: string;
  icon: ReactNode;
  detail?: string;
  control: ReactNode;
};

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
  triggerWhenOpen?: ReactNode;
  rows: SettingsRow[];
  onOpenChange?: (isOpen: boolean) => void;
  isDisabled?: boolean;
  tone?: 'default' | 'overlay';
  className?: string;
};

export type { SettingsChoiceRow, SettingsMenuProps, SettingsPanelRow, SettingsRow };
