import { Icon } from '@ValenceUI/Icon';
import { ArrowDown01Icon, ArrowUp01Icon, UnfoldMoreIcon } from '@hugeicons/core-free-icons';
import { useState } from 'react';
import { useTable } from '@tanstack/react-table';
import { Button } from '@ValenceUI/Button';
import { cn } from '@ValenceUI/cn';
import { HoverHighlight } from '@ValenceUI/HoverHighlight';
import { PageDots } from '@ValenceUI/PageDots';
import { useSlidingHighlight } from '@ValenceUI/useSlidingHighlight';
import { dataTableFeatures } from './dataTableFeatures';
import type { RowData, SortingState } from '@tanstack/react-table';
import type { DataTableProps } from './DataTable.types';

const ROWS_A_PAGE = 25;

const NEAR_THE_END = 200;

/**
 * A table of things that can be sorted by any column and paged through, with the single highlight
 * that follows the pointer down the rows. Rows can lead somewhere; where they do, the whole row is
 * the press target rather than a link inside it.
 *
 * @param label - What the table lists, read out to anybody who cannot see it.
 * @param columns - The columns, each saying how to read a row and whether it can be sorted by.
 * @param rows - The things to list.
 * @param emptyMessage - What to say when there are none, rather than showing an empty grid.
 * @param onChooseRow - Told which row was pressed, where rows lead somewhere.
 * @param toolbar - Controls to sit above the table, such as a search box.
 * @param pageSize - How many rows to show at once.
 * @param growsOnScroll - Whether reaching the bottom loads more rather than paging.
 * @param className - Extra classes for the caller's own layout.
 */
const DataTable = <Row extends RowData>({
  label,
  columns,
  rows,
  emptyMessage = 'Nothing here yet.',
  onChooseRow,
  toolbar,
  pageSize = ROWS_A_PAGE,
  growsOnScroll = false,
  className,
}: DataTableProps<Row>) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(0);
  const [shown, setShown] = useState(pageSize);
  const { containerRef, rect, follow, clear } = useSlidingHighlight();

  const holding = Math.min(shown, Math.max(rows.length, pageSize));

  const reachEnd = (box: HTMLElement) => {
    if (!growsOnScroll || holding >= rows.length) {
      return;
    }

    if (box.scrollHeight - box.scrollTop - box.clientHeight < NEAR_THE_END) {
      setShown(holding + pageSize);
    }
  };

  const table = useTable({
    features: dataTableFeatures,
    data: rows,
    columns,
    state: {
      sorting,
      pagination: growsOnScroll
        ? { pageIndex: 0, pageSize: holding }
        : { pageIndex: page, pageSize },
    },
    onSortingChange: setSorting,
    onPaginationChange: (next) => {
      setPage(
        typeof next === 'function' ? next({ pageIndex: page, pageSize }).pageIndex : next.pageIndex,
      );
    },
  });

  const pageCount = table.getPageCount();

  return (
    <div className={cn('flex flex-col pb-3', className)}>
      {toolbar === undefined ? null : (
        <div className="flex flex-wrap items-center justify-end gap-3 px-5 pb-3">{toolbar}</div>
      )}

      <div
        ref={containerRef}
        onPointerMove={follow}
        onPointerLeave={clear}
        onScroll={(event) => {
          reachEnd(event.currentTarget);
        }}
        className={cn(
          'relative overflow-x-auto',
          growsOnScroll ? 'valence-rail max-h-[28rem] overflow-y-auto' : '',
        )}
      >
        <HoverHighlight rect={rect} radius="md" className="bg-[var(--surface-hover)]" />

        <table className="w-full border-collapse text-sm" aria-label={label}>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const direction = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.14em] text-text-muted sm:px-5"
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <Button
                          variant="bare"
                          size="none"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1.5 text-current transition-colors hover:text-text"
                        >
                          <table.FlexRender header={header} />

                          {direction === 'asc' ? (
                            <Icon of={ArrowUp01Icon} size={13} />
                          ) : direction === 'desc' ? (
                            <Icon of={ArrowDown01Icon} size={13} />
                          ) : (
                            <Icon of={UnfoldMoreIcon} size={13} className="opacity-40" />
                          )}
                        </Button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody className="relative z-10">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getAllLeafColumns().length}
                  className="px-5 py-8 text-center font-body text-text-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-highlight={row.id}
                  onClick={
                    onChooseRow === undefined
                      ? undefined
                      : () => {
                          onChooseRow(row.original);
                        }
                  }
                  className={cn(onChooseRow === undefined ? '' : 'cursor-pointer')}
                >
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-3 align-middle sm:px-5">
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {growsOnScroll ? (
        holding >= rows.length ? null : (
          <p className="px-5 pt-3 font-body text-xs text-text-muted">
            {`Showing ${holding.toString()} of ${rows.length.toString()} · scroll for more`}
          </p>
        )
      ) : pageCount <= 1 ? null : (
        <div className="flex items-center justify-between gap-4 px-5 pt-3">
          <p className="font-body text-xs text-text-muted">
            {`Page ${(page + 1).toString()} of ${pageCount.toString()} · ${rows.length.toString()} in total`}
          </p>

          <PageDots
            count={pageCount}
            selectedIndex={page}
            onSelect={setPage}
            label={`${label}, by page`}
          />
        </div>
      )}
    </div>
  );
};

DataTable.displayName = 'DataTable';

export { DataTable };
