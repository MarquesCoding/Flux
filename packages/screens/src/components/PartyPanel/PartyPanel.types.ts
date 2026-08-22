import type { PartyRole, WatchParty } from '@ValenceContracts/schemas/WatchParty';

type Askable = {
  id: string;
  name: string;
  accountId?: string;
};

type PartyPanelProps = {
  party: WatchParty;
  meConnectionId: string | null;
  waitingFor?: readonly string[];
  onSetRole?: (connectionId: string, role: PartyRole) => void;
  onLoosen?: (how: { everyoneMaySeek?: boolean; everyoneMayPlayPause?: boolean }) => void;
  onLeave?: () => void;
  onRemove?: (connectionId: string) => void;
  onSetPassword?: (password: string | null) => void;
  people?: readonly Askable[];
  onAsk?: (profileId: string) => void;
  invitation?: string;
  onCopyInvitation?: (invitation: string) => Promise<void>;
};

export type { PartyPanelProps, Askable };
