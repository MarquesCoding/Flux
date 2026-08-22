import type { PartyRole, WatchParty } from '@ValenceContracts/schemas/WatchParty';
import type { Askable } from '@ValenceScreens/components/PartyPanel/PartyPanel.types';

type PartyMenuProps = {
  party: WatchParty | null;
  meConnectionId: string | null;
  waitingFor?: readonly string[];
  invitation?: string;
  isDisabled?: boolean;
  onOpen?: () => void;
  onLeave?: () => void;
  onRemove?: (connectionId: string) => void;
  onSetPassword?: (password: string | null) => void;
  people?: readonly Askable[];
  onAsk?: (profileId: string) => void;
  isHidden?: boolean;
  onSetRole?: (connectionId: string, role: PartyRole) => void;
  onLoosen?: (how: { everyoneMaySeek?: boolean; everyoneMayPlayPause?: boolean }) => void;
  onCopyInvitation?: (invitation: string) => Promise<void>;
  onOpenChange?: (isOpen: boolean) => void;
};

export type { PartyMenuProps };
