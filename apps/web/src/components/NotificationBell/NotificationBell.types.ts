import type { Notification } from '@FluxContracts/schemas/Notification';

type NotificationBellProps = {
  notifications: Notification[];
  unread: number;
  /**
   * Whether this browser can be woken, and whether it already is.
   *
   * Absent where push is unavailable — an older browser, a page served over
   * plain HTTP, or a server with no keys — and the switch is not drawn at
   * all rather than drawn and refusing.
   */
  push?: { isOn: boolean; onToggle: () => void };
  onOpen: () => void;
  onRead: (id: string) => void;
  onReadAll: () => void;
  /**
   * Where a notification leads, when it has somewhere to go.
   */
  onFollow: (link: string) => void;
};

export type { NotificationBellProps };
