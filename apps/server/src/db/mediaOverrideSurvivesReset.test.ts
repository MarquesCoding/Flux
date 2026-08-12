import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { mediaItem, mediaOverride } from './Schema';

describe('a correction, which a reset must not destroy', () => {
  it('does not hang off the rows that a reset deletes', () => {
    const pointsAtItems = getTableConfig(mediaOverride).foreignKeys.some(
      (key) => key.reference().foreignTable === mediaItem,
    );

    expect(pointsAtItems).toBe(false);
  });

  it('hangs off the library, which a reset leaves alone', () => {
    const targets = getTableConfig(mediaOverride).foreignKeys.map(
      (key) => getTableConfig(key.reference().foreignTable).name,
    );

    expect(targets).toEqual(['library']);
  });

  it('is found by path, which is what a rebuilt row is rediscovered by', () => {
    const columns = getTableConfig(mediaOverride).columns.map((column) => column.name);

    expect(columns).toContain('path');
    expect(columns).toContain('libraryId');
  });

  it('is one correction per file, so a second one replaces the first', () => {
    const unique = getTableConfig(mediaOverride)
      .indexes.filter((index) => index.config.unique)
      .map((index) => index.config.columns.map((column) => ('name' in column ? column.name : '')));

    expect(unique).toContainEqual(['libraryId', 'path']);
  });
});
