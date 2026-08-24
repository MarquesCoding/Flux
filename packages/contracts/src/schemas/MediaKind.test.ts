import { describe, expect, it } from 'vitest';
import { MEDIA_KINDS, MEDIA_KIND_LABELS, MediaKindSchema } from './MediaKind';

describe('MEDIA_KINDS', () => {
  it('admits a book, which ADR-0027 keeps out of media_item but not out of this vocabulary', () => {
    expect(MEDIA_KINDS).toContain('book');
  });

  it('names every kind, so nothing reaches a chat channel as a bare identifier', () => {
    for (const kind of MEDIA_KINDS) {
      expect(MEDIA_KIND_LABELS[kind]).not.toBe('');
    }
  });
});

describe('MediaKindSchema', () => {
  it('reads a kind it knows', () => {
    expect(MediaKindSchema.parse('episode')).toBe('episode');
  });

  it('refuses a kind Valence does not have', () => {
    expect(MediaKindSchema.safeParse('podcast').success).toBe(false);
  });
});
