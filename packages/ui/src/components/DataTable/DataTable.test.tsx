import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable } from './DataTable';
import type { DataTableColumn } from './DataTable.types';

type Library = { name: string; items: number };

const COLUMNS: DataTableColumn<Library>[] = [
  { id: 'name', header: 'Name', accessorFn: (library) => library.name },
  { id: 'items', header: 'Items', accessorFn: (library) => library.items },
];

const ROWS: Library[] = [
  { name: 'Films', items: 106 },
  { name: 'Shows', items: 38 },
];

describe('DataTable', () => {
  it('names the table, for anybody who cannot see what it lists', () => {
    render(<DataTable label="Library roots" columns={COLUMNS} rows={ROWS} />);

    expect(screen.getByRole('table', { name: 'Library roots' })).toBeInTheDocument();
  });

  it('draws a row for each thing and a heading for each column', () => {
    render(<DataTable label="Library roots" columns={COLUMNS} rows={ROWS} />);

    expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Films' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Shows' })).toBeInTheDocument();
  });

  it('says so where there is nothing to list', () => {
    render(
      <DataTable
        label="Library roots"
        columns={COLUMNS}
        rows={[]}
        emptyMessage="No libraries yet."
      />,
    );

    expect(screen.getByText('No libraries yet.')).toBeInTheDocument();
  });

  it('tells the caller which row was chosen, where rows can be', async () => {
    const onChooseRow = vi.fn();
    const user = userEvent.setup();

    render(
      <DataTable label="Library roots" columns={COLUMNS} rows={ROWS} onChooseRow={onChooseRow} />,
    );

    await user.click(screen.getByRole('cell', { name: 'Shows' }));

    expect(onChooseRow).toHaveBeenCalledWith(ROWS[1]);
  });

  it('draws a toolbar above the rows where it is given one', () => {
    render(
      <DataTable
        label="Library roots"
        columns={COLUMNS}
        rows={ROWS}
        toolbar={<span data-testid="tools" />}
      />,
    );

    expect(screen.getByTestId('tools')).toBeInTheDocument();
  });
});
