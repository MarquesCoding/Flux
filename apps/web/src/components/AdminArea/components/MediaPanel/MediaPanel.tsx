import { useCallback, useMemo, useState } from 'react';
import { RiRefreshLine, RiSearchLine } from '@remixicon/react';
import { Badge } from '@FluxUI/Badge';
import { Button } from '@FluxUI/Button';
import { Card } from '@FluxUI/Card';
import { CardHeader } from '@FluxUI/CardHeader';
import { DataTable } from '@FluxUI/DataTable';
import { TextField } from '@FluxUI/TextField';
import type { DataTableColumn } from '@FluxUI/DataTable.types';
import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { MediaPanelProps } from './MediaPanel.types';

/**
 * Names a row by its programme rather than by the episode standing in for it, so a series appears
 * under its own name rather than under whichever episode happened to be first.
 *
 * @param item - The item the row is for.
 * @returns What to call it.
 */
const nameOf = (item: MediaSummary): string => item.seriesTitle ?? item.title;

/**
 * Whether an item is an episode of a programme rather than a film, which decides both what its row
 * is called and which corrections make sense for it.
 *
 * @param item - The item.
 * @returns Whether it belongs to a programme.
 */
const isSeries = (item: MediaSummary): boolean =>
  item.seriesTitle !== null && item.seriesTitle !== undefined;

/**
 * Everything the libraries hold, searchable, with the two corrections an administrator can make to
 * any of it: saying what a mismatched file really is, and rebuilding the previews and thumbnails
 * made from it.
 *
 * @param isUnreachable - Whether the service is not answering.
 * @param media - Everything the libraries hold.
 * @param onCorrect - Called with the item whose match is to be corrected.
 * @param onRebuildArtefacts - Called with the item whose previews and thumbnails are to be remade,
 *   answering whether the request was accepted.
 */
const MediaPanel = ({
  isUnreachable = false,
  media,
  onCorrect,
  onRebuildArtefacts,
}: MediaPanelProps) => {
  const [search, setSearch] = useState('');
  const [rebuilding, setRebuilding] = useState<string | null>(null);
  const [rebuilt, setRebuilt] = useState<ReadonlySet<string>>(new Set());

  const rebuild = useCallback(
    async (item: MediaSummary) => {
      setRebuilding(item.id);

      const thrownAway = await onRebuildArtefacts(item);

      setRebuilding(null);

      if (thrownAway) {
        setRebuilt((known) => new Set(known).add(item.id));
      }
    },
    [onRebuildArtefacts],
  );

  const shown = useMemo(
    () => media.filter((item) => nameOf(item).toLowerCase().includes(search.trim().toLowerCase())),
    [media, search],
  );

  const columns = useMemo<DataTableColumn<MediaSummary>[]>(
    () => [
      {
        id: 'title',
        header: 'Title',
        accessorFn: nameOf,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-text">{nameOf(row.original)}</span>

            {isSeries(row.original) ? (
              <span className="truncate font-body text-xs text-text-muted">
                {row.original.title}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'kind',
        header: 'Kind',
        accessorFn: (item) => (isSeries(item) ? 'Series' : 'Film'),
        cell: ({ row }) => (
          <Badge size="sm" tone={isSeries(row.original) ? 'accent' : 'quiet'}>
            {isSeries(row.original) ? 'Series' : 'Film'}
          </Badge>
        ),
      },
      {
        id: 'year',
        header: 'Year',
        accessorFn: (item) => item.year ?? 0,
        cell: ({ row }) => (
          <span className="tabular-nums text-text-muted">{row.original.year ?? '—'}</span>
        ),
      },
      {
        id: 'artwork',
        header: 'Artwork',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.hasPoster ? (
            <span className="font-body text-xs text-text-muted">Poster</span>
          ) : (
            <span className="font-body text-xs text-danger">Missing</span>
          ),
      },
      {
        id: 'correct',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              isPill
              isLoading={rebuilding === row.original.id}
              onClick={() => {
                void rebuild(row.original);
              }}
            >
              <RiRefreshLine size={15} aria-hidden />
              {rebuilding === row.original.id
                ? 'Rebuilding…'
                : rebuilt.has(row.original.id)
                  ? 'Will rebuild'
                  : 'Rebuild previews'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              isPill
              onClick={() => {
                onCorrect(row.original);
              }}
            >
              <RiSearchLine size={15} aria-hidden />
              Wrong match?
            </Button>
          </span>
        ),
      },
    ],
    [onCorrect, rebuild, rebuilding, rebuilt],
  );

  return (
    <Card as="section" padding="none" className="flex flex-col">
      <CardHeader title="Everything in the libraries">
        <TextField
          label="Find a programme or film"
          isLabelHidden
          size="sm"
          isPill
          type="search"
          placeholder="Find a title"
          value={search}
          onValueChange={setSearch}
          className="w-64 max-w-full"
        />
      </CardHeader>

      {isUnreachable ? (
        <p className="px-5 pb-6 text-sm text-text-muted">
          The libraries could not be read from the server. This is not the same as holding nothing.
        </p>
      ) : (
        <DataTable
          label="Everything in the libraries"
          columns={columns}
          rows={shown}
          pageSize={10}
          emptyMessage={
            media.length === 0 ? 'Nothing has been scanned yet.' : 'Nothing here matches that.'
          }
        />
      )}
    </Card>
  );
};

MediaPanel.displayName = 'MediaPanel';

export { MediaPanel };
