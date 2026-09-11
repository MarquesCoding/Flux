import { Icon } from '@ValenceUI/Icon';
import { PanelCard } from '@ValenceScreens/components/PanelCard/PanelCard';
import { Unlink01Icon } from '@hugeicons/core-free-icons';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CouldNotRead } from '@ValenceUI/CouldNotRead';
import { Badge } from '@ValenceUI/Badge';
import { Button } from '@ValenceUI/Button';
import { ConfirmDialog } from '@ValenceUI/ConfirmDialog';
import { DataTable } from '@ValenceUI/DataTable';
import { Spinner } from '@ValenceUI/Spinner';
import { revokeShare } from '@ValenceClient/sharing/fetchShares';
import { shareQueries } from '@ValenceClient/query/shareQueries';
import { saidWhen } from '@ValenceClient/format/saidWhen';
import { standingOf } from '@ValenceScreens/sharing/standingOf';
import { untilWhen } from '@ValenceClient/sharing/untilWhen';
import { saidOpened } from '@ValenceClient/sharing/saidOpened';
import type { DataTableColumn } from '@ValenceUI/DataTable.types';
import type { Share } from '@ValenceContracts/schemas/Share';

/**
 * The links this account has handed out: what each points at, when it was made, what will end it,
 * how far through its allowance it is, and a way to withdraw it.
 *
 * A withdrawn link stays in the list rather than disappearing. Somebody who has just withdrawn one
 * wants to see that it happened, and a link that ended on its own is the same kind of fact.
 */
const SharePanel = () => {
  const cache = useQueryClient();
  const asked = useQuery(shareQueries.mine());
  const [withdrawing, setWithdrawing] = useState<Share | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const columns = useMemo<DataTableColumn<Share>[]>(
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
    <PanelCard title="Your links" isFlush>
      <ConfirmDialog
        title="Withdraw this link?"
        detail={
          withdrawing === null
            ? ''
            : `The link to ${withdrawing.title} stops working at once, including for anybody watching through it right now.`
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

          void revokeShare(share.id)
            .then(async () => cache.invalidateQueries({ queryKey: shareQueries.key }))
            .finally(() => {
              setIsWorking(false);
              setWithdrawing(null);
            });
        }}
      />

      <p className="px-4 pt-4 text-sm text-text-muted">
        Anybody holding one of these can watch what it points at without an account here.
        Withdrawing a link stops it at once, including for anybody watching through it.
      </p>

      {asked.isError ? (
        <CouldNotRead
          what="Your links"
          isTryingAgain={asked.isFetching}
          onTryAgain={() => {
            void asked.refetch();
          }}
        />
      ) : asked.isPending ? (
        <div className="p-4">
          <Spinner label="Reading your links" size="sm" />
        </div>
      ) : (
        <DataTable
          label="Links you have handed out"
          columns={columns}
          rows={asked.data}
          emptyMessage="You have not handed out any links. Sharing something from its page makes one."
        />
      )}
    </PanelCard>
  );
};

SharePanel.displayName = 'SharePanel';

export { SharePanel };
