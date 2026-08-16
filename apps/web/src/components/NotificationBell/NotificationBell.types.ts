import type { Notification } from '@FluxContracts/schemas/Notification';

type NotificationBellProps = {
  notifications: Notification[];
  unread: number;
  push?: { isOn: boolean; onToggle: () => void };
  onOpen: () => void;
  onRead: (id: string) => void;
  onReadAll: () => void;
  onFollow: (link: string) => void;
};

export type { NotificationBellProps };
