import { describe, expect, it } from 'vitest';
import { describeValenceMemory } from './describeValenceMemory';

describe('describeValenceMemory', () => {
  it('says nothing was measured rather than reading as nothing being used', () => {
    expect(describeValenceMemory(null)).toBe('not measured');
  });

  it('says a size somebody would say out loud', () => {
    expect(describeValenceMemory(1024 ** 3)).toBe('1.0 GB');
  });

  it('reports an idle Valence as idle', () => {
    expect(describeValenceMemory(0)).toBe('0 B');
  });
});
