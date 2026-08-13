import { describe, expect, it } from 'vitest';
import { describeAcceleration } from './describeAcceleration';

describe('describeAcceleration', () => {
  it('reports what the machine was found capable of when nobody has insisted', () => {
    expect(describeAcceleration('', ['videotoolbox']).label).toBe('videotoolbox · automatic');
  });

  it('stops claiming hardware once software only is forced', () => {
    expect(describeAcceleration('none', ['videotoolbox']).label).toBe('Software only · forced');
  });

  it('reports the forced backend rather than the one that was found', () => {
    expect(describeAcceleration('nvenc', ['nvenc']).label).toBe('NVENC · forced');
  });

  it('marks a backend this machine never proved it could do', () => {
    const shown = describeAcceleration('nvenc', ['videotoolbox']);

    expect(shown.label).toBe('NVENC · forced');
    expect(shown.tone).toBe('danger');
  });

  it('says what a choice the machine cannot keep will actually do', () => {
    expect(describeAcceleration('nvenc', ['videotoolbox']).detail).toContain(
      'fall back to software',
    );
  });

  it('marks forced software as costly rather than as broken', () => {
    const shown = describeAcceleration('none', ['videotoolbox']);

    expect(shown.tone).toBe('warning');
    expect(shown.detail).toContain('done by the processor');
  });

  it('leaves software chosen by nobody quiet, since there is nothing to reconsider', () => {
    expect(describeAcceleration('', []).tone).toBe('quiet');
  });

  it('explains even a setting that is working, which is the one nobody understands', () => {
    expect(describeAcceleration('', ['videotoolbox']).detail).toContain('whichever backend');
  });

  it('does not mark a forced backend the machine did verify', () => {
    expect(describeAcceleration('vaapi', ['vaapi', 'qsv']).tone).toBe('quiet');
  });

  it('says software only when nothing was found and nothing was chosen', () => {
    expect(describeAcceleration('', []).label).toBe('Software only');
  });

  it('lists everything the machine can do, not only the first', () => {
    expect(describeAcceleration('', ['vaapi', 'qsv']).label).toBe('vaapi, qsv · automatic');
  });

  it('shows a backend it has no name for rather than nothing at all', () => {
    expect(describeAcceleration('something-new', []).label).toBe('something-new · forced');
  });
});
