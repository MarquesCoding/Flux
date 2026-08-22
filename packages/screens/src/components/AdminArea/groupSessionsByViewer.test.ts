import { describe, expect, it } from 'vitest';
import { groupSessionsByViewer } from './groupSessionsByViewer';
import type { ActiveSession } from '@ValenceClient/admin/fetchAdmin';

const session = (overrides: Partial<ActiveSession> = {}): ActiveSession => ({
  clientId: 'cli_1',
  profileId: 'prf_1',
  profileName: 'Dan',
  deviceLabel: 'Chrome on macOS',
  connectedAt: 0,
  playback: null,
  ...overrides,
});

describe('groupSessionsByViewer', () => {
  it('answers nothing for nobody', () => {
    expect(groupSessionsByViewer([])).toEqual([]);
  });

  it('gathers every tab one person has open', () => {
    const groups = groupSessionsByViewer([
      session({ clientId: 'cli_1' }),
      session({ clientId: 'cli_2' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.sessions).toHaveLength(2);
  });

  it('keeps different viewers apart', () => {
    const groups = groupSessionsByViewer([
      session({ profileId: 'prf_1', profileName: 'Dan' }),
      session({ clientId: 'cli_2', profileId: 'prf_2', profileName: 'Sam' }),
    ]);

    expect(groups.map((group) => group.label)).toEqual(['Dan', 'Sam']);
  });

  it('gathers unidentified tabs under one heading rather than one each', () => {
    const groups = groupSessionsByViewer([
      session({ clientId: 'cli_1', profileId: null, profileName: null }),
      session({ clientId: 'cli_2', profileId: null, profileName: null }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe('Unknown viewer');
  });

  it('keeps the order it was given, so the list does not reshuffle itself', () => {
    const groups = groupSessionsByViewer([
      session({ profileId: 'prf_2', profileName: 'Sam' }),
      session({ clientId: 'cli_2', profileId: 'prf_1', profileName: 'Dan' }),
    ]);

    expect(groups.map((group) => group.label)).toEqual(['Sam', 'Dan']);
  });

  it('names a group by its key, so a re-render finds the same one', () => {
    const groups = groupSessionsByViewer([session()]);

    expect(groups[0]?.key).toBe('prf_1');
  });
});
