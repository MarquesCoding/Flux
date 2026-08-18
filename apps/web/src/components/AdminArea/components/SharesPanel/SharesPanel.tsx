import { Icon } from '@FluxUI/Icon';
import { Unlink01Icon } from '@hugeicons/core-free-icons';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CouldNotRead } from '@FluxUI/CouldNotRead';
import { Badge } from '@FluxUI/Badge';
import { Button } from '@FluxUI/Button';
import { Card } from '@FluxUI/Card';
import { CardHeader } from '@FluxUI/CardHeader';
import { ConfirmDialog } from '@FluxUI/ConfirmDialog';
import { DataTable } from '@FluxUI/DataTable';
import { Spinner } from '@FluxUI/Spinner';
import { revokeAnybodysShare } from '@FluxClient/sharing/fetchShares';
import { adminQueries } from '@FluxClient/query/adminQueries';
import { saidWhen } from '@FluxClient/format/saidWhen';
import { standingOf } from '@FluxWeb/sharing/standingOf';
import { untilWhen } from '@FluxClient/sharing/untilWhen';
import { saidOpened } from '@FluxClient/sharing/saidOpened';
import type { DataTableColumn } from '@FluxUI/DataTable.types';
import type { AdminShare } from '@FluxContracts/schemas/Share';

/**
 * Every link this server has handed out, whoever handed it out: what each points at, who made it,
 * what will end it, how far through its allowance it is, and a way to withdraw it.
 *
 * Withdrawing somebody else's link tells them it happened and who did it. That is deliberate — a
 * link disappearing without a word is the kind of silent act that makes a shared server feel
 * arbitrary, and whoever made it is the one who has to explain to the person holding it.
 */
const SharesPanel = () => {
  const cache = useQueryClient();
  const asked = useQuery(adminQueries.shares());
  const [withdrawing, setWithdrawing] = useState<AdminShare | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const columns = useMemo<DataTableColumn<AdminShare>[]>(
    () => [
      {
        id: 'title',
        header: 'Link to',
        accessorFn: (share) => share.title,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium text-text">{row.original.title}</span>

              {row.original.kind !== 'series' ? null : <Badge size="sm">Whole series</Badge>}
            </span>

            <span className="truncate text-xs text-text-muted">
              Made {saidWhen(row.original.createdAt)}
            </span>
          </span>
        ),
      },
      {
        id: 'createdBy',
        header: 'Handed out by',
        accessorFn: (share) => share.createdByName,
        cell: ({ row }) => (
          <span className="truncate text-sm text-text">{row.original.createdByName}</span>
        ),
      },
      {
        id: 'standing',
        header: 'Standing',
        accessorFn: (share) => standingOf(share, Date.now()).label,
        cell: ({ row }) => {
          const standing = standingOf(row.original, Date.now());

          return (
            <span className="flex min-w-0 flex-col items-start gap-1">
              <Badge size="sm" tone={standing.tone}>
                {standing.label}
              </Badge>

              {standing.label !== 'Live' ? null : (
                <span className="truncate text-xs text-text-muted">{untilWhen(row.original)}</span>
              )}
            </span>
          );
        },
      },
      {
        id: 'opened',
        header: 'Opened',
        accessorFn: (share) => share.views,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-text-muted">
            {saidOpened(row.original)}
          </span>
        ),
      },
      {
        id: 'act',
        header: '',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.isSpent ? null : (
            <span className="flex justify-end">
              <Button
                isIconOnly
                variant="ghost"
                size="sm"
                label={`Withdraw the link to ${row.original.title}`}
                onClick={() => {
                  setWithdrawing(row.original);
                }}
              >
                <Icon of={Unlink01Icon} size={16} />
              </Button>
            </span>
          ),
      },
    ],
    [],
  );

  return (
    <Card as="section" padding="none" className="flex flex-col">
      <ConfirmDialog
        title="Withdraw this link?"
        detail={
          withdrawing === null
            ? ''
            : `${withdrawing.createdByName}’s link to ${withdrawing.title} stops working at once, including for anybody watching through it right now. They will be told it was withdrawn.`
        }
        confirmLabel="Withdraw it"
        isDestructive
        isBusy={isWorking}
        isOpen={withdrawing !== null}
        onClose={() => {
          setWithdrawing(null);
        }}
        onConfirm={() => {
          const share = withdrawing;

          if (share === null) {
            return;
          }

          setIsWorking(true);

          void revokeAnybodysShare(share.id)
            .then(async () => cache.invalidateQueries({ queryKey: adminQueries.shares().queryKey }))
            .finally(() => {
              setIsWorking(false);
              setWithdrawing(null);
            });
        }}
      />

      <CardHeader title="Links handed out" />

      <p className="px-4 pt-4 text-sm text-text-muted">
        Anybody holding one of these can watch what it points at without an account here.
        Withdrawing a link stops it at once, and tells whoever made it.
      </p>

      {asked.isError ? (
        <CouldNotRead
          what="The links"
          isTryingAgain={asked.isFetching}
          onTryAgain={() => {
            void asked.refetch();
          }}
        />
      ) : asked.isPending ? (
        <div className="p-4">
          <Spinner label="Reading the links" size="sm" />
        </div>
      ) : (
        <DataTable
          label="Links handed out"
          columns={columns}
          rows={asked.data}
          emptyMessage="Nobody has handed out a link."
        />
      )}
    </Card>
  );
};

SharesPanel.displayName = 'SharesPanel';

export { SharesPanel };
