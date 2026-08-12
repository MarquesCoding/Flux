import { useState } from 'react';
import { useTable } from '@tanstack/react-table';
import { IconArrowDown, IconArrowUp, IconArrowsSort } from '@tabler/icons-react';
import { Button } from '@FluxUI/Button';
import { cn } from '@FluxUI/cn';
import { HoverHighlight } from '@FluxUI/HoverHighlight';
import { PageDots } from '@FluxUI/PageDots';
import { useSlidingHighlight } from '@FluxUI/useSlidingHighlight';
import { dataTableFeatures } from './dataTableFeatures';
import type { RowData, SortingState } from '@tanstack/react-table';
import type { DataTableProps } from './DataTable.types';

/**
 * How many rows a page holds before it is worth splitting.
 *
 * Large enough that most tables never paginate, small enough that a library of
 * hundreds does not become a scroll with no end in sight.
 */
const ROWS_A_PAGE = 25;

/**
 * How close to the bottom counts as having reached it.
 *
 * A little before the end rather than at it, so the next rows are already
 * there by the time somebody scrolls to where they would be.
 */
const NEAR_THE_END = 200;

/**
 * A table of things, sortable, with the highlight that follows the pointer.
 *
 * The one table in Flux. Every list of rows an operator reads — media,
 * accounts, jobs, sessions — is this, so that sorting works the same way
 * everywhere and a column added to one is a column and not a redesign.
 *
 * The header is a row of buttons rather than a row of headings with click
 * handlers, because sorting a table is something you do and a keyboard should
 * be able to do it.
 *
 * A long table can either page or grow. Paging suits a list somebody works
 * through — accounts, media — where "which page was I on" is a real question.
 * Growing suits a log, where the interesting rows are at the top and the rest
 * is history nobody navigates by number.
 *
 * Columns and rows must keep their identity between renders — memo the columns
 * and hold the rows in state. A column definition rebuilt each pass is a new
 * `cell` function each pass, which React reads as a different component and
 * remounts: any menu open in a row closes the moment anything on the page
 * changes, which on a page polling a server is constantly.
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

  /**
   * How many rows a growing table is currently holding.
   *
   * Kept as its own count rather than a page, and never allowed past what
   * there is: rows arrive and leave under a live table, and a count left
   * pointing beyond the end would ask for a page that is not there.
   */
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
    <div className={cn('flex flex-col px-2 pb-3 pt-1', className)}>
      {toolbar === undefined ? null : (
        <div className="flex flex-wrap items-center justify-end gap-3 px-2 pb-3">{toolbar}</div>
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
          growsOnScroll ? 'flux-rail max-h-[28rem] overflow-y-auto' : '',
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
                      className="px-2 py-2 text-left text-xs font-medium uppercase tracking-[0.14em] text-text-muted"
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
                            <IconArrowUp size={13} aria-hidden />
                          ) : direction === 'desc' ? (
                            <IconArrowDown size={13} aria-hidden />
                          ) : (
                            <IconArrowsSort size={13} className="opacity-40" aria-hidden />
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
                  className="px-3 py-8 text-center font-body text-text-muted"
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
                    <td key={cell.id} className="px-2 py-3 align-middle">
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
          <p className="px-2 pt-3 font-body text-xs text-text-muted">
            {`Showing ${holding.toString()} of ${rows.length.toString()} · scroll for more`}
          </p>
        )
      ) : pageCount <= 1 ? null : (
        <div className="flex items-center justify-between gap-4 px-3 pt-3">
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
