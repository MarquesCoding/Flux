import { describe, expect, it } from 'vitest';
import { describeAcceleration } from './describeAcceleration';

describe('describeAcceleration', () => {
  it('reports what the machine was found capable of when nobody has insisted', () => {
    expect(describeAcceleration('', ['videotoolbox'])).toEqual({
      labels: ['videotoolbox'],
      note: 'automatic',
    });
  });

  it('stops claiming hardware once software only is forced', () => {
    expect(describeAcceleration('none', ['videotoolbox'])).toEqual({
      labels: ['Software only'],
      note: 'forced',
    });
  });

  it('reports the forced backend rather than the one that was found', () => {
    expect(describeAcceleration('nvenc', ['videotoolbox'])).toEqual({
      labels: ['NVENC'],
      note: 'forced',
    });
  });

  it('says a forced choice is forced, so it reads as deliberate', () => {
    expect(describeAcceleration('qsv', []).note).toBe('forced');
  });

  it('keeps a forced backend the probe rejected, because that is the point of forcing', () => {
    expect(describeAcceleration('vaapi', [])).toEqual({ labels: ['VAAPI'], note: 'forced' });
  });

  it('says nothing about how it chose when there was nothing to choose', () => {
    expect(describeAcceleration('', [])).toEqual({ labels: ['None'] });
  });

  it('lists everything the machine can do, not only the first', () => {
    expect(describeAcceleration('', ['vaapi', 'qsv']).labels).toEqual(['vaapi', 'qsv']);
  });

  it('shows a backend it has no name for rather than nothing at all', () => {
    expect(describeAcceleration('something-new', [])).toEqual({
      labels: ['something-new'],
      note: 'forced',
    });
  });
});
