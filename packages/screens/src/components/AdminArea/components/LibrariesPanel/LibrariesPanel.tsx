import { Icon } from '@ValenceUI/Icon';
import {
  Add01Icon,
  Delete02Icon,
  Image02Icon,
  InformationCircleIcon,
  MoreHorizontalIcon,
  RefreshIcon,
  ReloadIcon,
  Settings02Icon,
} from '@hugeicons/core-free-icons';
import { useMemo, useRef, useState } from 'react';
import { ActionMenu } from '@ValenceUI/ActionMenu';
import { ConfirmDialog } from '@ValenceUI/ConfirmDialog';
import { notify } from '@ValenceUI/notify';
import { deleteLibrary } from '@ValenceClient/library/fetchLibrary';
import { Badge } from '@ValenceUI/Badge';
import { DataTable } from '@ValenceUI/DataTable';
import { HoverCard } from '@ValenceUI/HoverCard';
import { Button } from '@ValenceUI/Button';
import { cn } from '@ValenceUI/cn';
import { describeScanResult } from '@ValenceClient/admin/describeScanResult';
import { AddLibraryDialog } from '@ValenceScreens/components/AdminArea/components/AddLibraryDialog/AddLibraryDialog';
import { LibrarySettingsDialog } from '@ValenceScreens/components/AdminArea/components/LibrarySettingsDialog/LibrarySettingsDialog';
import { ResetLibrariesDialog } from '@ValenceScreens/components/AdminArea/components/ResetLibrariesDialog/ResetLibrariesDialog';
import { ScanProgressBar } from '@ValenceScreens/components/AdminArea/components/ScanProgressBar/ScanProgressBar';
import { describeScanKind } from '@ValenceScreens/components/AdminArea/describeScanKind';
import { describeSince } from '@ValenceScreens/components/AdminArea/describeSince';
import type { DataTableColumn } from '@ValenceUI/DataTable.types';
import type { Library } from '@ValenceContracts/schemas/Library';
import type { LibrariesPanelProps } from './LibrariesPanel.types';
import { PanelCard } from '@ValenceScreens/components/PanelCard/PanelCard';

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
 * @param onLibraryDeleted - Told a library has been deleted, so the list can let it go.
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
  onLibraryDeleted,
}: LibrariesPanelProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [settingsLibraryId, setSettingsLibraryId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Library | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isBusy = libraries.length === 0 || progress.size > 0;

  const live = useRef({
    progress,
    onScan,
    onRegeneratePreviews,
    setSettingsLibraryId,
    setDeleting,
  });

  live.current = { progress, onScan, onRegeneratePreviews, setSettingsLibraryId, setDeleting };

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

              <Icon of={InformationCircleIcon} size={15} className="shrink-0 text-text-muted" />
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
              trigger={<Icon of={MoreHorizontalIcon} size={16} />}
              groups={[
                {
                  items: [
                    {
                      id: 'scan',
                      label: 'Scan for changes',
                      icon: <Icon of={RefreshIcon} size={15} />,
                      isDisabled: live.current.progress.get(row.original.id) !== undefined,
                      onChoose: () => {
                        live.current.onScan(row.original.id);
                      },
                    },
                    {
                      id: 'reread',
                      label: 'Read every file again',
                      icon: <Icon of={ReloadIcon} size={15} />,
                      isDisabled: live.current.progress.get(row.original.id) !== undefined,
                      onChoose: () => {
                        live.current.onScan(row.original.id, true);
                      },
                    },
                    {
                      id: 'previews',
                      label: 'Generate missing previews',
                      icon: <Icon of={Image02Icon} size={15} />,
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
                      icon: <Icon of={Settings02Icon} size={15} />,
                      onChoose: () => {
                        live.current.setSettingsLibraryId(row.original.id);
                      },
                    },
                  ],
                },
                {
                  items: [
                    {
                      id: 'delete',
                      label: 'Delete library',
                      icon: <Icon of={Delete02Icon} size={15} />,
                      isDestructive: true,
                      onChoose: () => {
                        live.current.setDeleting(row.original);
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
      title="Libraries"
      isFlush
      actions={
        <>
          <Button
            variant="ghost"
            size="xs"
            isPill
            isLoading={isScanningAll}
            disabled={isBusy}
            onClick={onScanAll}
          >
            <Icon of={ReloadIcon} size={16} />
            Scan all libraries
          </Button>

          <Button
            variant="danger"
            size="xs"
            isPill
            isLoading={isResettingAll}
            disabled={isBusy}
            onClick={() => {
              setIsConfirmingReset(true);
            }}
          >
            <Icon of={Delete02Icon} size={16} />
            Reset and rebuild
          </Button>

          <Button
            variant="glossy"
            size="xs"
            isPill
            onClick={() => {
              setIsAdding(true);
            }}
          >
            <Icon of={Add01Icon} size={16} />
            Add library
          </Button>
        </>
      }
    >
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

      <ConfirmDialog
        title={deleting === null ? 'Delete this library?' : `Delete ${deleting.name}?`}
        detail="Valence forgets this library and everything it knows about what is in it — watch progress, ratings, favourites, previews and thumbnails. The files on disk are not touched. Anything running for it now is stopped."
        confirmLabel="Delete library"
        isDestructive
        isBusy={isDeleting}
        isOpen={deleting !== null}
        onClose={() => {
          setDeleting(null);
        }}
        onConfirm={() => {
          const doomed = deleting;

          if (doomed === null) {
            return;
          }

          setIsDeleting(true);

          void deleteLibrary(doomed.id)
            .then(() => {
              onLibraryDeleted(doomed.id);
            })
            .catch(() => {
              notify.failed(`${doomed.name} could not be deleted.`);
            })
            .finally(() => {
              setIsDeleting(false);
              setDeleting(null);
            });
        }}
      />

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
    </PanelCard>
  );
};

LibrariesPanel.displayName = 'LibrariesPanel';

export { LibrariesPanel };
