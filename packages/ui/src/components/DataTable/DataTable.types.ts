import type { ColumnDef, RowData } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import type { dataTableFeatures } from './dataTableFeatures';

type DataTableColumn<Row extends RowData> = ColumnDef<typeof dataTableFeatures, Row>;

type DataTableProps<Row extends RowData> = {
  /**
   * What the table is called, for whoever cannot see its heading.
   */
  label: string;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  /**
   * What to say instead of drawing an empty grid.
   */
  emptyMessage?: string;
  /**
   * Called when a row is chosen, which is what opens a drawer about it.
   *
   * Rows are only pressable when this is given: a row that highlights under
   * the pointer and does nothing when pressed is a promise the table breaks.
   */
  onChooseRow?: (row: Row) => void;
  /**
   * Drawn at the right of the header, for a search field or an action.
   */
  toolbar?: ReactNode;
  /**
   * How many rows a page holds. A table shorter than this shows no pagination
   * at all, since one page of one is not a choice anybody needs offering.
   */
  pageSize?: number;
  /**
   * Grows as it is scrolled rather than paging.
   *
   * The table gets a height of its own and holds `pageSize` rows more each
   * time the bottom comes near. For a log rather than a list: page numbers are
   * only useful where somebody might want to come back to one.
   */
  growsOnScroll?: boolean;
  className?: string;
};

export type { DataTableColumn, DataTableProps };
