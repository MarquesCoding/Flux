import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { library } from './Schema';

const generation = () =>
  getTableConfig(library).columns.find((column) => column.name === 'generation');

describe('the generation a reset raises', () => {
  it('is on the library, which is what a reset is scoped to', () => {
    expect(generation()).toBeDefined();
  });

  it('is never absent, because it addresses every preview the library owns', () => {
    expect(generation()?.notNull).toBe(true);
  });

  it('starts at zero, so libraries that already exist keep the artefacts they have', () => {
    expect(generation()?.hasDefault).toBe(true);
    expect(generation()?.default).toBe(0);
  });

  it('counts, rather than recording a time', () => {
    expect(generation()?.getSQLType()).toBe('integer');
  });
});
