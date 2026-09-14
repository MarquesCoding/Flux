import { describe, expect, it } from 'vitest';
import { createPlaybackSessions } from './createPlaybackSessions';

describe('createPlaybackSessions', () => {
  it('holds nothing until somebody starts something', () => {
    const sessions = createPlaybackSessions();

    expect(sessions.isHeld('session-1')).toBe(false);
    expect(sessions.isClaimedBy('session-1', 'profile-1')).toBe(false);
  });

  it('answers for the viewer who started a session', () => {
    const sessions = createPlaybackSessions();

    sessions.claim('session-1', 'profile-1');

    expect(sessions.isHeld('session-1')).toBe(true);
    expect(sessions.isClaimedBy('session-1', 'profile-1')).toBe(true);
  });

  it('refuses a viewer who started nothing, for a session somebody else started', () => {
    const sessions = createPlaybackSessions();

    sessions.claim('session-1', 'profile-1');

    expect(sessions.isClaimedBy('session-1', 'somebody-else')).toBe(false);
  });

  it('holds both claims where two viewers share the one session', () => {
    const sessions = createPlaybackSessions();

    sessions.claim('session-1', 'profile-1');
    sessions.claim('session-1', 'profile-2');

    expect(sessions.isClaimedBy('session-1', 'profile-1')).toBe(true);
    expect(sessions.isClaimedBy('session-1', 'profile-2')).toBe(true);
  });

  it('lets one viewer go without taking the other out of their stream', () => {
    const sessions = createPlaybackSessions();

    sessions.claim('session-1', 'profile-1');
    sessions.claim('session-1', 'profile-2');
    sessions.release('session-1', 'profile-1');

    expect(sessions.isClaimedBy('session-1', 'profile-1')).toBe(false);
    expect(sessions.isClaimedBy('session-1', 'profile-2')).toBe(true);
    expect(sessions.isHeld('session-1')).toBe(true);
  });

  it('forgets a session once the last viewer has let it go', () => {
    const sessions = createPlaybackSessions();

    sessions.claim('session-1', 'profile-1');
    sessions.release('session-1', 'profile-1');

    expect(sessions.isHeld('session-1')).toBe(false);
  });

  it('takes a claim being let go twice, and one that was never made', () => {
    const sessions = createPlaybackSessions();

    sessions.claim('session-1', 'profile-1');
    sessions.release('session-1', 'profile-1');
    sessions.release('session-1', 'profile-1');
    sessions.release('session-2', 'profile-1');

    expect(sessions.isHeld('session-1')).toBe(false);
  });

  it('keeps one session’s viewers apart from another’s', () => {
    const sessions = createPlaybackSessions();

    sessions.claim('session-1', 'profile-1');
    sessions.claim('session-2', 'profile-2');

    expect(sessions.isClaimedBy('session-1', 'profile-2')).toBe(false);
    expect(sessions.isClaimedBy('session-2', 'profile-1')).toBe(false);
  });
});
