import type { MoodLight } from '@FluxUI/MoodBackground.types';
import type { ReactNode } from 'react';
import type { LibraryKind } from '@FluxContracts/schemas/Library';

const SHELL_SECTIONS = [
  'home',
  'shows',
  'films',
  'new',
  'favourites',
  'search',
  'account',
  'admin',
] as const;

const BROWSE_SECTIONS = ['home', 'shows', 'films', 'new', 'favourites'] as const;

type ShellSection = (typeof SHELL_SECTIONS)[number];

type AppShellProps = {
  section: ShellSection;
  onSectionChange: (section: ShellSection) => void;
  children: ReactNode;
  moodLights?: MoodLight[];
  isAdministrator?: boolean;
  avatar?: ReactNode;
  onSurprise?: (only?: LibraryKind) => void;
  surpriseKinds?: LibraryKind[];
  notifications?: ReactNode;
};

export type { AppShellProps, ShellSection };

export { SHELL_SECTIONS, BROWSE_SECTIONS };
