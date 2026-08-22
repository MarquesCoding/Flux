import type { MoodLight } from '@ValenceUI/MoodBackground.types';
import type { ReactNode } from 'react';
import type { LibraryKind } from '@ValenceContracts/schemas/Library';

const BROWSE_SECTIONS = ['home', 'shows', 'films', 'new', 'favourites', 'read'] as const;

type ShellSection =
  'home' | 'shows' | 'films' | 'new' | 'favourites' | 'read' | 'search' | 'account' | 'admin';

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

export { BROWSE_SECTIONS };
