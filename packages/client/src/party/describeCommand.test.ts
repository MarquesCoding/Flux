import { describe, expect, it } from 'vitest';
import { describeCommand } from './describeCommand';
import type { PartyCommand, SequencedCommand } from '@ValenceContracts/schemas/WatchParty';

const issued = (command: PartyCommand, byConnectionId = 'dan'): SequencedCommand => ({
  sequence: 1,
  atMs: 1000,
  byName: 'Dan',
  byConnectionId,
  command,
});

describe('describeCommand', () => {
  it('says who paused', () => {
    expect(describeCommand(issued({ kind: 'pause', atSeconds: 10 }), 'sam')).toBe('Dan paused');
  });

  it('says who started it again', () => {
    expect(describeCommand(issued({ kind: 'play', atSeconds: 10 }), 'sam')).toBe(
      'Dan pressed play',
    );
  });

  it('says where somebody skipped to, since that is the disruptive one', () => {
    expect(describeCommand(issued({ kind: 'seek', atSeconds: 3723 }), 'sam')).toBe(
      'Dan skipped to 1:02:03',
    );
  });

  it('says when somebody put something else on', () => {
    expect(describeCommand(issued({ kind: 'changeWhatIsPlaying', mediaId: 'other' }), 'sam')).toBe(
      'Dan put something else on',
    );
  });

  it('says nothing about what you did yourself', () => {
    expect(describeCommand(issued({ kind: 'pause', atSeconds: 10 }, 'sam'), 'sam')).toBeNull();
  });

  it('still speaks for a tab that does not know which connection it is', () => {
    expect(describeCommand(issued({ kind: 'pause', atSeconds: 10 }), null)).toBe('Dan paused');
  });
});
