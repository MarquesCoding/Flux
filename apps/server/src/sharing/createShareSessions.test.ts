import { describe, expect, it } from 'vitest';
import { createShareSessions } from './createShareSessions';

describe('createShareSessions', () => {
  it('claims nothing until a share starts something', () => {
    const sessions = createShareSessions();

    expect(sessions.isClaimedBy('session-1', 'share-1')).toBe(false);
  });

  it('answers for the share that started a session', () => {
    const sessions = createShareSessions();

    sessions.claim('session-1', 'share-1');

    expect(sessions.isClaimedBy('session-1', 'share-1')).toBe(true);
  });

  it('refuses a share that started nothing, for a session somebody else started', () => {
    const sessions = createShareSessions();

    sessions.claim('session-1', 'share-1');

    expect(sessions.isClaimedBy('session-1', 'another-share')).toBe(false);
  });

  it('holds both claims where two links start the same session', () => {
    const sessions = createShareSessions();

    sessions.claim('session-1', 'share-1');
    sessions.claim('session-1', 'another-share');

    expect(sessions.isClaimedBy('session-1', 'share-1')).toBe(true);
    expect(sessions.isClaimedBy('session-1', 'another-share')).toBe(true);
  });

  it('lets a share go without taking the other claims with it', () => {
    const sessions = createShareSessions();

    sessions.claim('session-1', 'share-1');
    sessions.claim('session-1', 'another-share');
    sessions.release('session-1', 'share-1');

    expect(sessions.isClaimedBy('session-1', 'share-1')).toBe(false);
    expect(sessions.isClaimedBy('session-1', 'another-share')).toBe(true);
  });

  it('forgets a session once the last share has let it go', () => {
    const sessions = createShareSessions();

    sessions.claim('session-1', 'share-1');
    sessions.release('session-1', 'share-1');

    expect(sessions.isClaimedBy('session-1', 'share-1')).toBe(false);
  });

  it('takes a claim being let go twice, and one that was never made', () => {
    const sessions = createShareSessions();

    sessions.claim('session-1', 'share-1');
    sessions.release('session-1', 'share-1');
    sessions.release('session-1', 'share-1');
    sessions.release('session-2', 'share-1');

    expect(sessions.isClaimedBy('session-1', 'share-1')).toBe(false);
  });

  it('keeps one session’s claims apart from another’s', () => {
    const sessions = createShareSessions();

    sessions.claim('session-1', 'share-1');
    sessions.claim('session-2', 'another-share');

    expect(sessions.isClaimedBy('session-1', 'another-share')).toBe(false);
    expect(sessions.isClaimedBy('session-2', 'share-1')).toBe(false);
  });
});
