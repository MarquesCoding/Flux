import { Icon } from '@ValenceUI/Icon';
import { PanelCard } from '@ValenceScreens/components/PanelCard/PanelCard';
import { Logout01Icon, MoreHorizontalIcon } from '@hugeicons/core-free-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionMenu } from '@ValenceUI/ActionMenu';
import { Badge } from '@ValenceUI/Badge';
import { Button } from '@ValenceUI/Button';
import { ConfirmDialog } from '@ValenceUI/ConfirmDialog';
import { DataTable } from '@ValenceUI/DataTable';
import { Spinner } from '@ValenceUI/Spinner';
import { endDevice, endOtherDevices, fetchDevices } from '@ValenceClient/account/fetchDevices';
import { saidWhen } from '@ValenceClient/format/saidWhen';
import type { DataTableColumn } from '@ValenceUI/DataTable.types';
import type { Device } from '@ValenceClient/account/fetchDevices';

/**
 * Everywhere this account is signed in — each device, when it was last used, and a way to end it.
 * This session is marked as this one so nobody ends it by accident, and there is one gesture for
 * ending every other at once.
 */
const DeviceList = () => {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [ending, setEnding] = useState<Device | null>(null);
  const [isEndingRest, setIsEndingRest] = useState(false);

  const read = useCallback(() => {
    void fetchDevices().then(setDevices);
  }, []);

  useEffect(read, [read]);

  const elsewhere = (devices ?? []).filter((device) => !device.isCurrent);

  const live = useRef({ onEnd: setEnding });

  live.current = { onEnd: setEnding };

  const columns = useMemo<DataTableColumn<Device>[]>(
    () => [
      {
        id: 'name',
        header: 'Device',
        accessorFn: (device) => device.name,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium text-text">{row.original.name}</span>

              {!row.original.isCurrent ? null : (
                <Badge size="sm" tone="accent">
                  This one
                </Badge>
              )}
            </span>

            {row.original.address === null ? null : (
              <span className="truncate text-xs text-text-muted">{row.original.address}</span>
            )}
          </span>
        ),
      },
      {
        id: 'signedIn',
        header: 'Signed in',
        accessorFn: (device) => device.signedInAt,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-text-muted">
            {saidWhen(row.original.signedInAt)}
          </span>
        ),
      },
      {
        id: 'act',
        header: '',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.isCurrent ? null : (
            <span className="flex justify-end">
              <ActionMenu
                label={`Actions for ${row.original.name}`}
                trigger={<Icon of={MoreHorizontalIcon} size={16} />}
                groups={[
                  {
                    items: [
                      {
                        id: 'end',
                        label: 'Sign this out',
                        icon: <Icon of={Logout01Icon} size={15} />,
                        isDestructive: true,
                        onChoose: () => {
                          live.current.onEnd(row.original);
                        },
                      },
                    ],
                  },
                ]}
              />
            </span>
          ),
      },
    ],
    [],
  );

  return (
    <PanelCard
      title="Devices"
      isFlush
      actions={
        elsewhere.length === 0 ? undefined : (
          <Button
            variant="soft"
            size="xs"
            onClick={() => {
              setIsEndingRest(true);
            }}
          >
            <Icon of={Logout01Icon} size={14} />
            Sign out everywhere else
          </Button>
        )
      }
    >
      <ConfirmDialog
        title="Sign this device out?"
        detail={
          ending === null
            ? ''
            : `${ending.name} will be signed out and whoever is using it has to sign in again.`
        }
        confirmLabel="Sign it out"
        isDestructive
        isOpen={ending !== null}
        onClose={() => {
          setEnding(null);
        }}
        onConfirm={() => {
          const device = ending;

          setEnding(null);

          if (device !== null) {
            void endDevice(device.id).then(read);
          }
        }}
      />

      <ConfirmDialog
        title="Sign out everywhere else?"
        detail={`${elsewhere.length.toString()} other ${
          elsewhere.length === 1 ? 'device' : 'devices'
        } will be signed out. This one stays as it is.`}
        confirmLabel="Sign them out"
        isDestructive
        isBusy={isWorking}
        isOpen={isEndingRest}
        onClose={() => {
          setIsEndingRest(false);
        }}
        onConfirm={() => {
          setIsWorking(true);

          void endOtherDevices().then(() => {
            setIsWorking(false);
            setIsEndingRest(false);
            read();
          });
        }}
      />

      {devices === null ? (
        <div className="p-4">
          <Spinner label="Reading your devices" size="sm" />
        </div>
      ) : (
        <DataTable
          label="Where you are signed in"
          columns={columns}
          rows={devices}
          emptyMessage="Nothing is signed in, which cannot be true of the thing you are reading this on. Try again in a moment."
        />
      )}
    </PanelCard>
  );
};

DeviceList.displayName = 'DeviceList';

export { DeviceList };
