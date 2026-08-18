import type { ColumnDef, RowData } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import type { dataTableFeatures } from './dataTableFeatures';

type DataTableColumn<Row extends RowData> = ColumnDef<typeof dataTableFeatures, Row>;

type DataTableProps<Row extends RowData> = {
  label: string;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  emptyMessage?: string;
  onChooseRow?: (row: Row) => void;
  toolbar?: ReactNode;
  pageSize?: number;
  growsOnScroll?: boolean;
  className?: string;
};

export type { DataTableColumn, DataTableProps };
