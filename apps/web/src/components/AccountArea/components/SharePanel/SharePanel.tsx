import { Icon } from '@FluxUI/Icon';
import { Unlink01Icon } from '@hugeicons/core-free-icons';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@FluxUI/Badge';
import { Button } from '@FluxUI/Button';
import { Card } from '@FluxUI/Card';
import { CardHeader } from '@FluxUI/CardHeader';
import { ConfirmDialog } from '@FluxUI/ConfirmDialog';
import { DataTable } from '@FluxUI/DataTable';
import { Spinner } from '@FluxUI/Spinner';
import { revokeShare } from '@FluxWeb/sharing/fetchShares';
import { shareQueries } from '@FluxWeb/query/shareQueries';
import { saidWhen } from '@FluxWeb/format/saidWhen';
import type { DataTableColumn } from '@FluxUI/DataTable.types';
import type { BadgeTone } from '@FluxUI/Badge.types';
import type { Share } from '@FluxContracts/schemas/Share';

type Standing = { label: string; tone: BadgeTone };

/**
 * Says how a link stands, and says which of the three ways it ended rather than only that it has.
 * Withdrawn, run out and used up are different things to have happened, and somebody looking at
 * their own links is usually trying to tell them apart.
 *
 * @param share - The link.
 * @param now - What to treat as now, so the phrasing can be tested.
 * @returns What to show and how loudly.
 */
const standingOf = (share: Share, now: number): Standing => {
  if (share.isRevoked) {
    return { label: 'Withdrawn', tone: 'quiet' };
  }

  if (share.expiresAt !== null && Date.parse(share.expiresAt) <= now) {
    return { label: 'Ran out', tone: 'quiet' };
  }

  return share.isSpent
    ? { label: 'All used up', tone: 'quiet' }
    : { label: 'Live', tone: 'accent' };
};

/**
 * Says what still holds a link open, for the one that is still working. A link with neither an end
 * date nor a limit works until somebody withdraws it, which is worth saying plainly.
 *
 * @param share - The link.
 * @returns The phrase to show.
 */
const untilWhen = (share: Share): string => {
  if (share.expiresAt !== null) {
    return `Runs out ${saidWhen(share.expiresAt)}`;
  }

  return share.viewCap === null ? 'Until you withdraw it' : 'Until it has been opened enough times';
};

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
            {row.original.viewCap === null
              ? `${row.original.views.toString()} times`
              : `${row.original.views.toString()} of ${row.original.viewCap.toString()} times`}
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

      <CardHeader title="Links you have handed out" />

      <p className="px-4 text-sm text-text-muted">
        Anybody holding one of these can watch what it points at without an account here.
        Withdrawing a link stops it at once, including for anybody watching through it.
      </p>

      {asked.isPending ? (
        <div className="p-4">
          <Spinner label="Reading your links" size="sm" />
        </div>
      ) : (
        <DataTable
          label="Links you have handed out"
          columns={columns}
          rows={asked.data ?? []}
          emptyMessage="You have not handed out any links. Sharing something from its page makes one."
        />
      )}
    </Card>
  );
};

SharePanel.displayName = 'SharePanel';

export { SharePanel };
