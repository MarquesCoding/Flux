import type { PartyRole, WatchParty } from '@FluxContracts/schemas/WatchParty';

type PartyMenuProps = {
  party: WatchParty | null;
  meConnectionId: string | null;
  invitation?: string;
  isDisabled?: boolean;
  onOpen?: () => void;
  onLeave?: () => void;
  onRemove?: (connectionId: string) => void;
  onSetPassword?: (password: string | null) => void;
  isHidden?: boolean;
  onSetRole?: (connectionId: string, role: PartyRole) => void;
  onLoosen?: (how: { everyoneMaySeek?: boolean; everyoneMayPlayPause?: boolean }) => void;
  onCopyInvitation?: (invitation: string) => Promise<void>;
  onOpenChange?: (isOpen: boolean) => void;
};

export type { PartyMenuProps };
