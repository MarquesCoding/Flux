import { describe, expect, it } from 'vitest';
import { describeCpuShare } from './describeCpuShare';

describe('describeCpuShare', () => {
  it('says so when there is no reading', () => {
    expect(describeCpuShare(null)).toBe('not measured');
  });

  it('does not round a running service down to nothing', () => {
    expect(describeCpuShare(0.27)).toBe('<1%');
  });

  it('keeps zero for a service using nothing at all', () => {
    expect(describeCpuShare(0)).toBe('0%');
  });

  it('says a real share plainly', () => {
    expect(describeCpuShare(19.3)).toBe('19%');
  });

  it('rounds to whole percent once there is a whole percent to round', () => {
    expect(describeCpuShare(1.4)).toBe('1%');
    expect(describeCpuShare(99.6)).toBe('100%');
  });
});
