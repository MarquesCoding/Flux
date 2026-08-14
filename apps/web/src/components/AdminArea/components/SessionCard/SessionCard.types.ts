import type { ActiveSession } from '@FluxWeb/admin/fetchAdmin';

type SessionCardProps = {
  session: ActiveSession;
  /**
   * Whether an admin action is in flight for this card, so its buttons show
   * their own loading state rather than the whole grid appearing to hang.
   */
  isBusy: boolean;
  onStop: () => void;
  /**
   * Sends the viewer a line of text. Nothing about what they are watching
   * changes, which is the whole difference between this and a pause.
   */
  onMessage: (text: string) => void;
  onPause: () => void;
  onResume: () => void;
};

export type { SessionCardProps };
