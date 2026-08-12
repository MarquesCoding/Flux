import {
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/react-table';

/**
 * The table features Flux asks for, and the row models they need.
 *
 * Declared once and outside any component: the table is parameterised by its
 * features, so building this in render would hand it a different table every
 * pass, and a column definition could not be typed against it.
 */
const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

export { dataTableFeatures };
