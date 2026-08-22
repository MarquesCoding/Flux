import { Icon } from '@FluxUI/Icon';
import {
  ArrowClockwiseIcon,
  ArrowsClockwiseIcon,
  DotsThreeIcon,
  GearSixIcon,
  ImageIcon,
  InfoIcon,
  PlusIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { useMemo, useRef, useState } from 'react';
import { ActionMenu } from '@FluxUI/ActionMenu';
import { Badge } from '@FluxUI/Badge';
import { DataTable } from '@FluxUI/DataTable';
import { HoverCard } from '@FluxUI/HoverCard';
import { Button } from '@FluxUI/Button';
import { Card } from '@FluxUI/Card';
import { CardHeader } from '@FluxUI/CardHeader';
import { cn } from '@FluxUI/cn';
import { describeScanResult } from '@FluxClient/admin/describeScanResult';
import { AddLibraryDialog } from '@FluxScreens/components/AdminArea/components/AddLibraryDialog/AddLibraryDialog';
import { LibrarySettingsDialog } from '@FluxScreens/components/AdminArea/components/LibrarySettingsDialog/LibrarySettingsDialog';
import { ResetLibrariesDialog } from '@FluxScreens/components/AdminArea/components/ResetLibrariesDialog/ResetLibrariesDialog';
import { ScanProgressBar } from '@FluxScreens/components/AdminArea/components/ScanProgressBar/ScanProgressBar';
import { describeScanKind } from '@FluxScreens/components/AdminArea/describeScanKind';
import { describeSince } from '@FluxScreens/components/AdminArea/describeSince';
import type { DataTableColumn } from '@FluxUI/DataTable.types';
import type { Library } from '@FluxContracts/schemas/Library';
import type { LibrariesPanelProps } from './LibrariesPanel.types';

/**
 * The folders Valence reads and what it is doing to them: adding one, scanning one or all of them,
 * rebuilding from nothing, regenerating previews, and each library's own settings. Progress is shown
 * against the library it belongs to rather than in one list, since which library is being worked on
 * is usually the thing worth knowing.
 *
 * @param isUnreachable - Whether the service is not answering.
 * @param libraries - The libraries configured.
 * @param progress - What is running now, by library.
 * @param isScanningAll - Whether a scan of every library is under way.
 * @param isResettingAll - Whether a rebuild of every library is under way.
 * @param onScan - Called with the library to scan, and whether to re-probe every file.
 * @param onScanAll - Called to scan every library.
 * @param onResetAll - Called to rebuild every library from nothing.
 * @param onRegeneratePreviews - Called with the library whose previews are to be remade.
 * @param onLibraryCreated - Called with a library that has just been added.
 * @param onLibraryUpdated - Called with a library whose settings have changed.
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
          <div className="flex flex-col gap-0.5">
            <span className="whitespace-nowrap text-xs text-text-muted">
              {describeSince(row.original.lastScannedAt, Date.now())}
            </span>

            {row.original.lastScan === undefined ? null : (
              <span
                className={cn(
                  'whitespace-nowrap text-xs',
                  row.original.lastScan.removed === 0 ? 'text-text-muted' : 'text-danger',
                )}
              >
                {describeScanResult(row.original.lastScan)}
              </span>
            )}
          </div>
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

              <Icon of={InfoIcon} size={15} className="shrink-0 text-text-muted" />
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
              trigger={<Icon of={DotsThreeIcon} size={16} />}
              groups={[
                {
                  items: [
                    {
                      id: 'scan',
                      label: 'Scan for changes',
                      icon: <Icon of={ArrowsClockwiseIcon} size={15} />,
                      isDisabled: live.current.progress.get(row.original.id) !== undefined,
                      onChoose: () => {
                        live.current.onScan(row.original.id);
                      },
                    },
                    {
                      id: 'reread',
                      label: 'Read every file again',
                      icon: <Icon of={ArrowClockwiseIcon} size={15} />,
                      isDisabled: live.current.progress.get(row.original.id) !== undefined,
                      onChoose: () => {
                        live.current.onScan(row.original.id, true);
                      },
                    },
                    {
                      id: 'previews',
                      label: 'Generate missing previews',
                      icon: <Icon of={ImageIcon} size={15} />,
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
                      icon: <Icon of={GearSixIcon} size={15} />,
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
            <Icon of={ArrowClockwiseIcon} size={16} />
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
            <Icon of={TrashIcon} size={16} />
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
            <Icon of={PlusIcon} size={16} />
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
