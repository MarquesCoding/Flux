import { Icon } from '@FluxUI/Icon';
import { BellIcon } from '@phosphor-icons/react';
import { Badge } from '@FluxUI/Badge';
import { Button } from '@FluxUI/Button';
import { PopoverPanel } from '@FluxUI/PopoverPanel';
import { Switch } from '@FluxUI/Switch';
import { describeSince } from '@FluxScreens/components/AdminArea/describeSince';
import type { NotificationBellProps } from './NotificationBell.types';

const COUNTED_UP_TO = 9;

/**
 * The bell in the dock and the list behind it: what has happened, what has not been read, and the
 * switch for having them pushed to this device even when the application is closed.
 *
 * @param notifications - What to show, newest first.
 * @param unread - How many have not been read, for the count on the bell.
 * @param push - Whether push is on for this device, and how to change it.
 * @param onOpen - Told when the list was opened.
 * @param onRead - Told which notification was read.
 * @param onReadAll - Told to mark everything read.
 * @param onClearAll - Told to take everything off the bell, which is different from having read it.
 * @param onFollow - Told where a notification leads, when one is pressed.
 */
const NotificationBell = ({
  notifications,
  unread,
  push,
  onOpen,
  onRead,
  onReadAll,
  onClearAll,
  onFollow,
}: NotificationBellProps) => {
  const now = Date.now();

  return (
    <PopoverPanel
      label="Notifications"
      side="bottom"
      align="center"
      onOpenChange={(isOpen) => {
        if (isOpen) {
          onOpen();
        }
      }}
      trigger={
        <span className="relative flex size-9 items-center justify-center">
          {unread === 0 ? <Icon of={BellIcon} size={20} /> : <Icon of={BellIcon} size={20} />}

          {unread === 0 ? null : (
            <Badge tone="accent" size="sm" className="absolute -right-1 -top-1">
              {unread > COUNTED_UP_TO ? `${COUNTED_UP_TO.toString()}+` : unread.toString()}
            </Badge>
          )}
        </span>
      }
    >
      <div className="flex w-80 flex-col gap-2 p-1">
        <div className="flex items-center justify-between gap-2 px-2 pt-1">
          <span className="text-sm font-medium text-text">Notifications</span>

          {unread === 0 ? null : (
            <Button
              variant="bare"
              size="none"
              className="text-xs text-text-muted"
              onClick={onReadAll}
            >
              Mark all read
            </Button>
          )}

          {notifications.length === 0 ? null : (
            <Button
              variant="bare"
              size="none"
              className="text-xs text-text-muted"
              onClick={onClearAll}
            >
              Clear all
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <p className="px-2 pb-2 text-xs text-text-muted">
            Nothing yet. New films and episodes will show up here.
          </p>
        ) : (
          <ul className="flex max-h-80 flex-col overflow-y-auto">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <Button
                  variant="bare"
                  size="none"
                  className="flex w-full flex-col items-start gap-0.5 rounded-lg px-2 py-2 text-left hover:bg-[var(--surface-hover)]"
                  onClick={() => {
                    onRead(notification.id);

                    if (notification.link !== null) {
                      onFollow(notification.link);
                    }
                  }}
                >
                  <span className="flex w-full items-center gap-2">
                    <span
                      className={
                        notification.readAt === null
                          ? 'text-sm font-medium text-text'
                          : 'text-sm text-text-muted'
                      }
                    >
                      {notification.title}
                    </span>

                    <span className="ml-auto shrink-0 text-xs text-text-muted">
                      {describeSince(notification.createdAt, now)}
                    </span>
                  </span>

                  <span className="text-xs text-text-muted">{notification.body}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}

        {push === undefined ? null : (
          <div className="border-t border-[var(--surface-line)] px-2 py-2">
            <Switch
              label="Also send these to this device"
              isOn={push.isOn}
              onToggle={push.onToggle}
            />
          </div>
        )}
      </div>
    </PopoverPanel>
  );
};

NotificationBell.displayName = 'NotificationBell';

export { NotificationBell };
