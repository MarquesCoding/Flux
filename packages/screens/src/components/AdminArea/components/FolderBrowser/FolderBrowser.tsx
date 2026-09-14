import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight01Icon, ArrowUp01Icon, Folder01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@ValenceUI/Button';
import { CouldNotRead } from '@ValenceUI/CouldNotRead';
import { Icon } from '@ValenceUI/Icon';
import { Spinner } from '@ValenceUI/Spinner';
import { adminQueries } from '@ValenceClient/query/adminQueries';
import { RequestFailed } from '@ValenceClient/query/RequestFailed';
import { pathSegments } from '@ValenceScreens/components/AdminArea/components/FolderBrowser/pathSegments';
import type { FolderBrowserProps } from './FolderBrowser.types';

/**
 * Walks the folders on the machine running Valence, so whoever adds a library can point at where it
 * lives instead of typing a path they have to remember exactly.
 *
 * Opens on the folder already typed, where there is one and it exists, and on the places worth
 * starting from otherwise — the top of the disk, the home folder, and wherever drives are usually
 * mounted. Only folders are shown, since a library is a folder. The trail along the top steps back
 * to any folder on the way down, and the folder being looked at is the one chosen: a library is the
 * folder you are in, not one of the folders inside it.
 *
 * @param start - The path already typed, which it opens on where it can.
 * @param onChoose - Told the folder chosen.
 * @param onCancel - Told to close without choosing.
 */
const FolderBrowser = ({ start, onChoose, onCancel }: FolderBrowserProps) => {
  const first = start.trim() === '' ? null : start.trim();
  const [at, setAt] = useState<string | null>(first);

  const asked = useQuery(adminQueries.folders(at));

  const status = asked.error instanceof RequestFailed ? asked.error.status : null;
  const isGone = status === 404 || status === 400;

  useEffect(() => {
    if (isGone && at !== null && at === first) {
      setAt(null);
    }
  }, [isGone, at, first]);

  const listing = asked.data ?? null;
  const folders = listing?.folders ?? [];
  const chosen = listing?.path ?? null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--surface-line)] p-3">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          isIconOnly
          variant="secondary"
          size="xs"
          label="Up a folder"
          disabled={at === null}
          onClick={() => {
            setAt(listing?.parent ?? null);
          }}
        >
          <Icon of={ArrowUp01Icon} size={14} />
        </Button>

        <nav
          aria-label="Where you are"
          className="valence-rail flex min-w-0 items-center gap-0.5 overflow-x-auto"
        >
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setAt(null);
            }}
          >
            Places
          </Button>

          {at === null
            ? null
            : pathSegments(at).map((segment) => (
                <span key={segment.path} className="flex shrink-0 items-center gap-0.5">
                  <Icon of={ArrowRight01Icon} size={12} className="text-text-muted" />

                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setAt(segment.path);
                    }}
                  >
                    {segment.label}
                  </Button>
                </span>
              ))}
        </nav>
      </div>

      <div className="valence-rail max-h-64 min-h-32 overflow-y-auto">
        {asked.isPending ? (
          <div className="flex justify-center p-6">
            <Spinner size="sm" label="Reading the folders" />
          </div>
        ) : status === 403 ? (
          <p className="p-4 text-sm text-text-muted">Valence is not allowed to read that folder.</p>
        ) : isGone ? (
          <p className="p-4 text-sm text-text-muted">That folder is not there.</p>
        ) : asked.isError ? (
          <CouldNotRead
            what="The folders"
            isTryingAgain={asked.isFetching}
            onTryAgain={() => {
              void asked.refetch();
            }}
          />
        ) : folders.length === 0 ? (
          <p className="p-4 text-sm text-text-muted">No folders in here.</p>
        ) : (
          <ul aria-label="Folders" className="flex flex-col">
            {folders.map((folder) => (
              <li key={folder.path}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    setAt(folder.path);
                  }}
                >
                  <Icon of={Folder01Icon} size={16} />
                  <span className="truncate">{folder.name}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {listing?.isTruncated === true ? (
        <p className="text-xs text-text-muted">
          Showing the first {folders.length.toString()} folders.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-text-muted">
          {chosen ?? 'Choose a place to start'}
        </span>

        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>

          <Button
            variant="primary"
            size="sm"
            disabled={chosen === null}
            onClick={() => {
              if (chosen !== null) {
                onChoose(chosen);
              }
            }}
          >
            Use this folder
          </Button>
        </div>
      </div>
    </div>
  );
};

FolderBrowser.displayName = 'FolderBrowser';

export { FolderBrowser };
