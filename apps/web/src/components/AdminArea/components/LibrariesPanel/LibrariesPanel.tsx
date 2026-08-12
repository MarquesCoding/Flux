import { useState } from 'react';
import { IconPlus, IconRefresh, IconRefreshAlert, IconTrash } from '@tabler/icons-react';
import { Badge } from '@FluxUI/Badge';
import { Button } from '@FluxUI/Button';
import { AddLibraryDialog } from '@FluxWeb/components/AdminArea/components/AddLibraryDialog/AddLibraryDialog';
import { LibrarySettingsDialog } from '@FluxWeb/components/AdminArea/components/LibrarySettingsDialog/LibrarySettingsDialog';
import { ResetLibrariesDialog } from '@FluxWeb/components/AdminArea/components/ResetLibrariesDialog/ResetLibrariesDialog';
import { ScanProgressBar } from '@FluxWeb/components/AdminArea/components/ScanProgressBar/ScanProgressBar';
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

  return (
    <div className="flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
        <h2 className="text-sm uppercase tracking-[0.16em] text-text-muted">Library roots</h2>

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
      </header>

      {libraries.length === 0 ? (
        <p className="p-5 text-sm text-text-muted">
          No libraries yet. Add one pointing at a folder of media.
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {libraries.map((library) => {
            const scanning = progress.get(library.id);

            return (
              <li
                key={library.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-sm text-text">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto rounded-none bg-transparent p-0 text-sm text-text hover:bg-transparent hover:underline"
                      onClick={() => {
                        setSettingsLibraryId(library.id);
                      }}
                    >
                      {library.name}
                    </Button>
                    <Badge size="sm">{library.kind}</Badge>
                  </span>

                  <span className="truncate text-xs text-text-muted" title={library.path}>
                    {library.path} ·{' '}
                    {library.itemCount === 1 ? '1 item' : `${library.itemCount.toString()} items`}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {scanning === undefined ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      isPill
                      onClick={() => {
                        onScan(library.id);
                      }}
                    >
                      <IconRefresh size={16} aria-hidden />
                      Scan
                    </Button>
                  ) : (
                    <ScanProgressBar
                      label={
                        scanning.kind === 'scan'
                          ? `Scanning ${library.name}`
                          : `Regenerating previews for ${library.name}`
                      }
                      phase={scanning.phase}
                      processed={scanning.processed}
                      total={scanning.total}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
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
    </div>
  );
};

LibrariesPanel.displayName = 'LibrariesPanel';

export { LibrariesPanel };
