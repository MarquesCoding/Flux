import { describe, expect, it } from 'vitest';
import { describeAcceleration } from './describeAcceleration';

describe('describeAcceleration', () => {
  it('reports what the machine was found capable of when nobody has insisted', () => {
    expect(describeAcceleration('', ['videotoolbox'])).toEqual({
      label: 'videotoolbox · automatic',
      isUnverified: false,
    });
  });

  it('stops claiming hardware once software only is forced', () => {
    expect(describeAcceleration('none', ['videotoolbox'])).toEqual({
      label: 'Software only · forced',
      isUnverified: false,
    });
  });

  it('reports the forced backend rather than the one that was found', () => {
    expect(describeAcceleration('nvenc', ['nvenc']).label).toBe('NVENC · forced');
  });

  it('marks a backend this machine never proved it could do', () => {
    const shown = describeAcceleration('nvenc', ['videotoolbox']);

    expect(shown.label).toBe('NVENC · forced');
    expect(shown.isUnverified).toBe(true);
  });

  it('says what a choice the machine cannot keep will actually do', () => {
    expect(describeAcceleration('nvenc', ['videotoolbox']).warning).toContain(
      'fall back to software',
    );
  });

  it('warns about nothing when the choice is one the machine can keep', () => {
    expect(describeAcceleration('videotoolbox', ['videotoolbox']).warning).toBeUndefined();
  });

  it('does not mark a forced backend the machine did verify', () => {
    expect(describeAcceleration('vaapi', ['vaapi', 'qsv']).isUnverified).toBe(false);
  });

  it('never marks software only, which needs no hardware to be available', () => {
    expect(describeAcceleration('none', []).isUnverified).toBe(false);
  });

  it('says software only when nothing was found and nothing was chosen', () => {
    expect(describeAcceleration('', [])).toEqual({
      label: 'Software only',
      isUnverified: false,
    });
  });

  it('lists everything the machine can do, not only the first', () => {
    expect(describeAcceleration('', ['vaapi', 'qsv']).label).toBe('vaapi, qsv · automatic');
  });

  it('shows a backend it has no name for rather than nothing at all', () => {
    expect(describeAcceleration('something-new', []).label).toBe('something-new · forced');
  });
});
