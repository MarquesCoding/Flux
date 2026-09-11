import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { mediaItem } from './Schema';

const columnNamed = (name: string) =>
  getTableConfig(mediaItem).columns.find((column) => column.name === name);

describe('what holds an extra against the thing it belongs to', () => {
  it('is a column on the item, since an extra is an item that happens to have a parent', () => {
    expect(columnNamed('parentId')).toBeDefined();
    expect(columnNamed('extraKind')).toBeDefined();
  });

  it('is absent for an ordinary item, which belongs to nothing', () => {
    expect(columnNamed('parentId')?.notNull).toBe(false);
    expect(columnNamed('extraKind')?.notNull).toBe(false);
  });

  it('takes an extra with the thing it hangs off, rather than leaving it orphaned', () => {
    const [held] = getTableConfig(mediaItem).foreignKeys.filter((key) =>
      key.reference().columns.some((column) => column.name === 'parentId'),
    );

    expect(held?.onDelete).toBe('cascade');
  });

  it('can find what hangs off an item without reading the whole library', () => {
    expect(
      getTableConfig(mediaItem).indexes.some((index) =>
        (index.config.columns ?? []).some(
          (column) => 'name' in column && column.name === 'parentId',
        ),
      ),
    ).toBe(true);
  });
});
