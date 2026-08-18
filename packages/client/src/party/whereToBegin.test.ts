import { describe, expect, it } from 'vitest';
import { whereToBegin } from './whereToBegin';
import type { Arrival } from './whereToBegin';

const arriving = (over?: Partial<Arrival>): Arrival => ({
  invitedTo: 'party-1',
  joined: null,
  roomSeconds: null,
  resumeSeconds: 60,
  isBeingAsked: false,
  hasWaitedLongEnough: false,
  ...over,
});

describe('whereToBegin', () => {
  it('begins where this account left off when no party is involved', () => {
    expect(whereToBegin(arriving({ invitedTo: null }))).toEqual({ kind: 'begin', atSeconds: 60 });
  });

  it('begins where the room is, not where this account left off', () => {
    expect(whereToBegin(arriving({ roomSeconds: 900 }))).toEqual({ kind: 'begin', atSeconds: 900 });
  });

  it('waits for a room it has been invited to but not yet heard from', () => {
    expect(whereToBegin(arriving())).toEqual({ kind: 'wait' });
  });

  it('does not wait for whoever is keeping time, since they are the reference', () => {
    expect(whereToBegin(arriving({ joined: 'party-1' }))).toEqual({ kind: 'begin', atSeconds: 60 });
  });

  it('does not wait behind a question the party is asking, which would hide it', () => {
    expect(whereToBegin(arriving({ isBeingAsked: true }))).toEqual({
      kind: 'begin',
      atSeconds: 60,
    });
  });

  it('gives up waiting rather than leaving somebody at a loading screen', () => {
    expect(whereToBegin(arriving({ hasWaitedLongEnough: true }))).toEqual({
      kind: 'begin',
      atSeconds: 60,
    });
  });

  it('still takes the room over its own position once the wait has run out', () => {
    expect(whereToBegin(arriving({ hasWaitedLongEnough: true, roomSeconds: 900 }))).toEqual({
      kind: 'begin',
      atSeconds: 900,
    });
  });

  it('begins at the start for somebody who has never watched it', () => {
    expect(whereToBegin(arriving({ invitedTo: null, resumeSeconds: 0 }))).toEqual({
      kind: 'begin',
      atSeconds: 0,
    });
  });
});
