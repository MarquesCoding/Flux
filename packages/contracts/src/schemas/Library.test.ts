import { describe, expect, it } from 'vitest';
import { LIBRARY_KINDS, SELECTABLE_LIBRARY_KINDS, LibraryKindSchema } from './Library';

describe('SELECTABLE_LIBRARY_KINDS', () => {
  it('does not offer music, which no scanner reads', () => {
    expect([...SELECTABLE_LIBRARY_KINDS]).not.toContain('music');
  });

  it('offers every kind that something does read', () => {
    expect([...SELECTABLE_LIBRARY_KINDS]).toEqual(LIBRARY_KINDS.filter((kind) => kind !== 'music'));
  });

  it('leaves a music library somebody already made able to be read back', () => {
    expect(LibraryKindSchema.parse('music')).toBe('music');
  });
});
