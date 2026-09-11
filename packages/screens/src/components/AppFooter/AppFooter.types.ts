import type { ShellSection } from '@ValenceScreens/components/AppShell/AppShell.types';

type AccountPanel = 'profile' | 'security' | 'devices';

type AppFooterProps = {
  places: { id: ShellSection; label: string }[];
  onPlace: (id: ShellSection) => void;
  onGenre: (genre: string) => void;
  onAccount: (panel: AccountPanel) => void;
  onAdmin?: () => void;
  onSignOut: () => void;
};

export type { AccountPanel, AppFooterProps };
