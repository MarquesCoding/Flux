import { useMemo, useRef, useState } from 'react';
import {
  IconDots,
  IconInfoCircle,
  IconPhoto,
  IconPlus,
  IconRefresh,
  IconRefreshAlert,
  IconSettings,
  IconTrash,
} from '@tabler/icons-react';
import { ActionMenu } from '@FluxUI/ActionMenu';
import { Badge } from '@FluxUI/Badge';
import { DataTable } from '@FluxUI/DataTable';
import { HoverCard } from '@FluxUI/HoverCard';
import { Button } from '@FluxUI/Button';
import { Card } from '@FluxUI/Card';
import { CardHeader } from '@FluxUI/CardHeader';
import { AddLibraryDialog } from '@FluxWeb/components/AdminArea/components/AddLibraryDialog/AddLibraryDialog';
import { LibrarySettingsDialog } from '@FluxWeb/components/AdminArea/components/LibrarySettingsDialog/LibrarySettingsDialog';
import { ResetLibrariesDialog } from '@FluxWeb/components/AdminArea/components/ResetLibrariesDialog/ResetLibrariesDialog';
import { ScanProgressBar } from '@FluxWeb/components/AdminArea/components/ScanProgressBar/ScanProgressBar';
import { describeScanKind } from '@FluxWeb/components/AdminArea/describeScanKind';
import { describeSince } from '@FluxWeb/components/AdminArea/describeSince';
import type { DataTableColumn } from '@FluxUI/DataTable.types';
import type { Library } from '@FluxContracts/schemas/Library';
import type { LibrariesPanelProps } from './LibrariesPanel.types';

/**
 * The folders Flux reads, and what it is doing to them.
 *
 * Which dialog is open is held here rather than by the admin area: adding a
 * library, confirming a rebuild and editing one are all this panel's business
 * and nothing else ever asks.
 *
 * Scanning everything and rebuilding everything are both disabled while any
 * one library is already scanning. Two scans over the same files is not twice
 * the work, it is the same work twice — and a rebuild starting underneath a
 * running scan is worse than that.
 */
const LibrariesPanel = ({
  isUnreachable = false,
  libraries,
  progress,
  isScanningAll,
  isResettingAll,
  onScan,
  onScanAll,
  onResetAll,
  onRegeneratePreviews,
  onLibraryCreated,
  onLibraryUpdated,
}: LibrariesPanelProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [settingsLibraryId, setSettingsLibraryId] = useState<string | null>(null);

  const isBusy = libraries.length === 0 || progress.size > 0;

  /**
   * What a column needs, without being rebuilt when it changes.
   *
   * Scanning pushes progress several times a second; a column rebuilt on each
   * push is a new `cell`, which React remounts — closing any menu or hover
   * card open in that row.
   */
  const live = useRef({ progress, onScan, onRegeneratePreviews, setSettingsLibraryId });

  live.current = { progress, onScan, onRegeneratePreviews, setSettingsLibraryId };

  const columns = useMemo<DataTableColumn<Library>[]>(
    () => [
      {
        id: 'name',
        header: 'Library',
        accessorFn: (library) => library.name,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <span className="truncate font-medium text-text">{row.original.name}</span>
              <Badge size="sm">{row.original.kind}</Badge>
            </span>

            <span className="truncate text-xs text-text-muted" title={row.original.path}>
              {row.original.path}
            </span>
          </span>
        ),
      },
      {
        id: 'items',
        header: 'Items',
        accessorFn: (library) => library.itemCount,
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-text-muted">
            {row.original.itemCount === 1 ? '1 item' : `${row.original.itemCount.toString()} items`}
          </span>
        ),
      },
      {
        id: 'scanned',
        header: 'Last read',
        accessorFn: (library) => library.lastScannedAt ?? '',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-text-muted">
            {describeSince(row.original.lastScannedAt, Date.now())}
          </span>
        ),
      },
      {
        id: 'state',
        header: 'State',
        enableSorting: false,
        cell: ({ row }) => {
          const scanning = live.current.progress.get(row.original.id);

          if (scanning === undefined) {
            return (
              <Badge size="sm" tone="quiet">
                Idle
              </Badge>
            );
          }

          return (
            <HoverCard
              side="left"
              align="center"
              detail={
                <div className="flex flex-col gap-3">
                  <span className="text-xs uppercase tracking-[0.14em] text-text-muted">
                    {describeScanKind(scanning.kind, row.original.name)}
                  </span>

                  <ScanProgressBar
                    label={describeScanKind(scanning.kind, row.original.name)}
                    phase={scanning.phase}
                    processed={scanning.processed}
                    total={scanning.total}
                  />
                </div>
              }
            >
              <Badge size="sm" tone="accent">
                Reading
              </Badge>

              <IconInfoCircle size={15} className="shrink-0 text-text-muted" aria-hidden />
            </HoverCard>
          );
        },
      },
      {
        id: 'act',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex justify-end">
            <ActionMenu
              label={`Actions for ${row.original.name}`}
              trigger={<IconDots size={16} aria-hidden />}
              groups={[
                {
                  items: [
                    {
                      id: 'scan',
                      label: 'Scan for changes',
                      icon: <IconRefresh size={15} aria-hidden />,
                      isDisabled: live.current.progress.get(row.original.id) !== undefined,
                      onChoose: () => {
                        live.current.onScan(row.original.id);
                      },
                    },
                    {
                      id: 'reread',
                      label: 'Read every file again',
                      icon: <IconRefreshAlert size={15} aria-hidden />,
                      isDisabled: live.current.progress.get(row.original.id) !== undefined,
                      onChoose: () => {
                        live.current.onScan(row.original.id, true);
                      },
                    },
                    {
                      id: 'previews',
                      label: 'Generate missing previews',
                      icon: <IconPhoto size={15} aria-hidden />,
                      isDisabled: live.current.progress.get(row.original.id) !== undefined,
                      onChoose: () => {
                        live.current.onRegeneratePreviews(row.original.id);
                      },
                    },
                  ],
                },
                {
                  items: [
                    {
                      id: 'settings',
                      label: 'Library settings',
                      icon: <IconSettings size={15} aria-hidden />,
                      onChoose: () => {
                        live.current.setSettingsLibraryId(row.original.id);
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
    <Card as="section" padding="none" className="flex flex-col overflow-hidden">
      <CardHeader title="Library roots">
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            isPill
            isLoading={isScanningAll}
            disabled={isBusy}
            onClick={onScanAll}
          >
            <IconRefreshAlert size={16} aria-hidden />
            Scan all libraries
          </Button>

          <Button
            variant="danger"
            size="sm"
            isPill
            isLoading={isResettingAll}
            disabled={isBusy}
            onClick={() => {
              setIsConfirmingReset(true);
            }}
          >
            <IconTrash size={16} aria-hidden />
            Reset and rebuild
          </Button>

          <Button
            variant="glossy"
            size="sm"
            isPill
            onClick={() => {
              setIsAdding(true);
            }}
          >
            <IconPlus size={16} aria-hidden />
            Add library
          </Button>
        </div>
      </CardHeader>

      {isUnreachable ? (
        <p className="p-6 text-sm text-text-muted">
          The libraries could not be read from the server. This is not the same as having none — do
          not add one until it answers again.
        </p>
      ) : libraries.length === 0 ? (
        <p className="p-6 text-sm text-text-muted">
          No libraries yet. Add one pointing at a folder of media.
        </p>
      ) : (
        <DataTable label="Library roots" columns={columns} rows={libraries} />
      )}

      <AddLibraryDialog
        isOpen={isAdding}
        onClose={() => {
          setIsAdding(false);
        }}
        onCreated={(library) => {
          setIsAdding(false);
          onLibraryCreated(library);
        }}
      />

      <ResetLibrariesDialog
        isOpen={isConfirmingReset}
        isResetting={isResettingAll}
        onClose={() => {
          setIsConfirmingReset(false);
        }}
        onConfirm={() => {
          setIsConfirmingReset(false);
          onResetAll();
        }}
      />

      <LibrarySettingsDialog
        key={settingsLibraryId ?? 'none'}
        library={libraries.find((entry) => entry.id === settingsLibraryId) ?? null}
        isOpen={settingsLibraryId !== null}
        onClose={() => {
          setSettingsLibraryId(null);
        }}
        onUpdated={onLibraryUpdated}
        onRegenerate={onRegeneratePreviews}
      />
    </Card>
  );
};

LibrariesPanel.displayName = 'LibrariesPanel';

export { LibrariesPanel };
