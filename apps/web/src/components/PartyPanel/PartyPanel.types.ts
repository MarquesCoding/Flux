import type { PartyRole, WatchParty } from '@FluxContracts/schemas/WatchParty';

type PartyPanelProps = {
  party: WatchParty;
  meConnectionId: string | null;
  onSetRole?: (connectionId: string, role: PartyRole) => void;
  onLoosen?: (how: { everyoneMaySeek?: boolean; everyoneMayPlayPause?: boolean }) => void;
  onLeave?: () => void;
};

export type { PartyPanelProps };
