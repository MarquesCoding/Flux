import { describe, expect, it } from 'vitest';
import { describeFluxMemory } from './describeFluxMemory';

describe('describeFluxMemory', () => {
  it('says nothing was measured rather than reading as nothing being used', () => {
    expect(describeFluxMemory(null)).toBe('Flux not measured');
  });

  it('speaks for the whole of Flux where the whole of Flux was measured', () => {
    expect(describeFluxMemory({ usedBytes: 1024 ** 3, scope: 'deployment' })).toBe('Flux 1.0 GB');
  });

  it('names the half it measured where that is all it could see', () => {
    expect(describeFluxMemory({ usedBytes: 512 * 1024 ** 2, scope: 'mediaService' })).toBe(
      'media service 512 MB',
    );
  });
});
