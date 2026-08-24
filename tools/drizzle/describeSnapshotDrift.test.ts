import { describe, expect, it } from 'vitest';
import { describeSnapshotDrift } from './describeSnapshotDrift';

describe('describeSnapshotDrift', () => {
  it('says nothing when generating produced nothing', () => {
    expect(describeSnapshotDrift([])).toBeNull();
  });

  it('names every file generating produced', () => {
    const said = describeSnapshotDrift(['0050_wide_lizard.sql', 'meta/0050_snapshot.json']);

    expect(said).toContain('0050_wide_lizard.sql');
    expect(said).toContain('meta/0050_snapshot.json');
  });

  it('lists them in a settled order, so the failure reads the same twice', () => {
    const said = describeSnapshotDrift(['meta/0050_snapshot.json', '0050_wide_lizard.sql']);

    expect(said).toBe(describeSnapshotDrift(['0050_wide_lizard.sql', 'meta/0050_snapshot.json']));
    expect(said?.indexOf('0050_wide_lizard.sql')).toBeLessThan(
      said?.indexOf('meta/0050_snapshot.json') ?? 0,
    );
  });

  it('says what to run, since knowing the tree drifted is not knowing what to do about it', () => {
    const said = describeSnapshotDrift(['meta/0050_snapshot.json']);

    expect(said).toContain('db:generate');
  });

  it('says to keep the hand-written SQL rather than what generate wrote', () => {
    const said = describeSnapshotDrift(['meta/0050_snapshot.json']);

    expect(said).toContain('keeping your own SQL');
  });

  it('does not mutate what it was given', () => {
    const produced = ['meta/0050_snapshot.json', '0050_wide_lizard.sql'];

    describeSnapshotDrift(produced);

    expect(produced).toStrictEqual(['meta/0050_snapshot.json', '0050_wide_lizard.sql']);
  });
});
