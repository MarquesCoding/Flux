import { describe, expect, it } from 'vitest';
import { describeFluxMemory } from './describeFluxMemory';

describe('describeFluxMemory', () => {
  it('says nothing was measured rather than reading as nothing being used', () => {
    expect(describeFluxMemory(null)).toBe('not measured');
  });

  it('says a size somebody would say out loud', () => {
    expect(describeFluxMemory(1024 ** 3)).toBe('1.0 GB');
  });

  it('reports an idle Valence as idle', () => {
    expect(describeFluxMemory(0)).toBe('0 B');
  });
});
