import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RiLogoutBoxRLine, RiMoreLine } from '@remixicon/react';
import { ActionMenu } from '@FluxUI/ActionMenu';
import { Badge } from '@FluxUI/Badge';
import { Button } from '@FluxUI/Button';
import { Card } from '@FluxUI/Card';
import { CardHeader } from '@FluxUI/CardHeader';
import { ConfirmDialog } from '@FluxUI/ConfirmDialog';
import { DataTable } from '@FluxUI/DataTable';
import { Spinner } from '@FluxUI/Spinner';
import { endDevice, endOtherDevices, fetchDevices } from '@FluxWeb/account/fetchDevices';
import type { DataTableColumn } from '@FluxUI/DataTable.types';
import type { Device } from '@FluxWeb/account/fetchDevices';

/**
 * Says when something happened, the way somebody would.
 */
const said = (when: string): string => {
  const at = new Date(when);

  return Number.isNaN(at.getTime())
    ? 'at some point'
    : at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

/**
 * Everywhere this account is signed in.
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
            {said(row.original.signedInAt)}
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
                trigger={<RiMoreLine size={16} aria-hidden />}
                groups={[
                  {
                    items: [
                      {
                        id: 'end',
                        label: 'Sign this out',
                        icon: <RiLogoutBoxRLine size={15} aria-hidden />,
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
    <Card as="section" padding="none" className="flex flex-col">
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

      <CardHeader title="Where you are signed in">
        {elsewhere.length === 0 ? null : (
          <Button
            variant="secondary"
            size="sm"
            isPill
            onClick={() => {
              setIsEndingRest(true);
            }}
          >
            <RiLogoutBoxRLine size={15} aria-hidden />
            Sign out everywhere else
          </Button>
        )}
      </CardHeader>

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
    </Card>
  );
};

DeviceList.displayName = 'DeviceList';

export { DeviceList };
