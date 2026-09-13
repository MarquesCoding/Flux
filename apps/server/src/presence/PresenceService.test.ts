import { describe, expect, it, vi } from 'vitest';
import { createPresenceService } from './PresenceService';
import type { PlaybackPlan, Reason } from '@ValenceContracts/schemas/PlaybackPlan';

const reason: Reason = { code: 'ClientSupportsSource', detail: 'Client declares support' };

const plan: PlaybackPlan = {
  mediaId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  container: { kind: 'passthrough', reason },
  video: { kind: 'passthrough', reason },
  audio: { kind: 'passthrough', streamIndex: 1, reason },
  subtitles: { kind: 'none', reason },
};

const PLAYBACK = {
  mediaId: 'media-1',
  mediaTitle: 'Arrival',
  hasPoster: true,
  hasBackdrop: true,
  mode: 'direct' as const,
  reuse: null,
  transcoderSessionId: null,
  plan,
};

describe('createPresenceService', () => {
  it('lists nobody before anyone connects', () => {
    const presence = createPresenceService();

    expect(presence.list()).toEqual([]);
  });

  it('lists a tab as soon as it connects, watching nothing', () => {
    const presence = createPresenceService();

    presence.connect({
      clientId: 'tab-1',
      accountId: null,
      profileId: 'profile-1',
      profileName: 'Dan',
      deviceLabel: 'Chrome on Mac',
      send: vi.fn(),
    });

    expect(presence.list()).toEqual([
      expect.objectContaining({ clientId: 'tab-1', profileName: 'Dan', playback: null }),
    ]);
  });

  it('says which account a tab belongs to, and nothing for one it has never heard of', () => {
    const presence = createPresenceService();

    presence.connect({
      clientId: 'tab-1',
      accountId: 'me',
      profileId: null,
      profileName: null,
      deviceLabel: 'Chrome on Mac',
      send: vi.fn(),
    });

    expect(presence.ownerOf('tab-1')).toBe('me');
    expect(presence.ownerOf('tab-2')).toBeNull();
  });

  it('refuses to let one account take over a tab belonging to another', () => {
    const presence = createPresenceService();
    const mine = vi.fn();

    expect(
      presence.connect({
        clientId: 'tab-1',
        accountId: 'me',
        profileId: null,
        profileName: 'Mine',
        deviceLabel: 'Chrome on Mac',
        send: mine,
      }),
    ).toBe(true);

    expect(
      presence.connect({
        clientId: 'tab-1',
        accountId: 'somebody-else',
        profileId: null,
        profileName: 'Theirs',
        deviceLabel: 'Chrome on Windows',
        send: vi.fn(),
      }),
    ).toBe(false);

    expect(presence.ownerOf('tab-1')).toBe('me');
    expect(presence.list()).toEqual([
      expect.objectContaining({ clientId: 'tab-1', profileName: 'Mine' }),
    ]);
  });

  it('lets the same account reconnect a tab it already had, as a new socket does', () => {
    const presence = createPresenceService();

    presence.connect({
      clientId: 'tab-1',
      accountId: 'me',
      profileId: null,
      profileName: null,
      deviceLabel: 'Chrome on Mac',
      send: vi.fn(),
    });

    expect(
      presence.connect({
        clientId: 'tab-1',
        accountId: 'me',
        profileId: null,
        profileName: null,
        deviceLabel: 'Chrome on Mac',
        send: vi.fn(),
      }),
    ).toBe(true);
  });

  it('forgets a tab once it disconnects', () => {
    const presence = createPresenceService();

    presence.connect({
      clientId: 'tab-1',
      accountId: null,
      profileId: null,
      profileName: null,
      deviceLabel: 'Chrome on Mac',
      send: vi.fn(),
    });
    presence.disconnect('tab-1');

    expect(presence.list()).toEqual([]);
  });

  it('shows what a tab starts watching', () => {
    const presence = createPresenceService();

    presence.connect({
      clientId: 'tab-1',
      accountId: null,
      profileId: null,
      profileName: null,
      deviceLabel: 'Chrome on Mac',
      send: vi.fn(),
    });
    presence.startPlayback('tab-1', PLAYBACK);

    expect(presence.list()).toMatchObject([
      { playback: { mediaTitle: 'Arrival', isPlaying: true } },
    ]);
  });

  it('carries what the media service found already made through to the session list', () => {
    const presence = createPresenceService();

    presence.connect({
      clientId: 'tab-1',
      accountId: null,
      profileId: null,
      profileName: null,
      deviceLabel: 'Chrome on Mac',
      send: vi.fn(),
    });
    presence.startPlayback('tab-1', { ...PLAYBACK, mode: 'transcode', reuse: 'shared' });

    expect(presence.list()).toMatchObject([{ playback: { reuse: 'shared' } }]);
  });

  it('clears playback once a tab stops watching', () => {
    const presence = createPresenceService();

    presence.connect({
      clientId: 'tab-1',
      accountId: null,
      profileId: null,
      profileName: null,
      deviceLabel: 'Chrome on Mac',
      send: vi.fn(),
    });
    presence.startPlayback('tab-1', PLAYBACK);
    presence.stopPlayback('tab-1');

    expect(presence.list()).toEqual([expect.objectContaining({ playback: null })]);
  });

  it('records whether a tab is actually playing', () => {
    const presence = createPresenceService();

    presence.connect({
      clientId: 'tab-1',
      accountId: null,
      profileId: null,
      profileName: null,
      deviceLabel: 'Chrome on Mac',
      send: vi.fn(),
    });
    presence.startPlayback('tab-1', PLAYBACK);
    presence.heartbeatPlayback('tab-1', false);

    expect(presence.list()).toMatchObject([{ playback: { isPlaying: false } }]);
  });

  it('has no health to report until a heartbeat carries one', () => {
    const presence = createPresenceService();

    presence.connect({
      clientId: 'tab-1',
      accountId: null,
      profileId: null,
      profileName: null,
      deviceLabel: 'Chrome on Mac',
      send: vi.fn(),
    });
    presence.startPlayback('tab-1', PLAYBACK);

    expect(presence.list()).toMatchObject([{ playback: { health: null } }]);
  });

  it('records what the player reports about buffer and picture size', () => {
    const presence = createPresenceService();

    presence.connect({
      clientId: 'tab-1',
      accountId: null,
      profileId: null,
      profileName: null,
      deviceLabel: 'Chrome on Mac',
      send: vi.fn(),
    });
    presence.startPlayback('tab-1', PLAYBACK);
    presence.heartbeatPlayback('tab-1', true, {
      positionSeconds: 600,
      durationSeconds: 7200,
      bufferedAheadSeconds: 12,
      presentedWidth: 1920,
      presentedHeight: 1080,
    });

    expect(presence.list()).toMatchObject([
      {
        playback: {
          health: {
            positionSeconds: 600,
            durationSeconds: 7200,
            bufferedAheadSeconds: 12,
            presentedWidth: 1920,
            presentedHeight: 1080,
          },
        },
      },
    ]);
  });

  it('tells a tab something without touching what it is watching', () => {
    const presence = createPresenceService();
    const send = vi.fn();

    presence.connect({
      clientId: 'tab-1',
      accountId: null,
      profileId: null,
      profileName: null,
      deviceLabel: 'Chrome on Mac',
      send: send,
    });
    presence.startPlayback('tab-1', PLAYBACK);

    expect(presence.message('tab-1', 'Restarting in five minutes')).toBe(true);
    expect(send).toHaveBeenCalledWith({ kind: 'message', text: 'Restarting in five minutes' });
    expect(presence.list()).toMatchObject([
      { playback: { isPlaying: true, pausedByAdmin: false } },
    ]);
  });

  it('does not tell anybody watching the session list that a message changed it', () => {
    const presence = createPresenceService();
    const watcher = vi.fn();

    presence.connect({
      clientId: 'tab-1',
      accountId: null,
      profileId: null,
      profileName: null,
      deviceLabel: 'Chrome on Mac',
      send: vi.fn(),
    });
    presence.startPlayback('tab-1', PLAYBACK);
    presence.watch(watcher);
    presence.message('tab-1', 'Tea is ready');

    expect(watcher).not.toHaveBeenCalled();
  });

  it('messages a tab that is watching nothing, since a banner is not a playback change', () => {
    const presence = createPresenceService();
    const send = vi.fn();

    presence.connect({
      clientId: 'tab-1',
      accountId: null,
      profileId: null,
      profileName: null,
      deviceLabel: 'Chrome on Mac',
      send: send,
    });

    expect(presence.message('tab-1', 'Tea is ready')).toBe(true);
  });

  it('fails quietly for a tab that has just closed', () => {
    const presence = createPresenceService();

    expect(presence.message('gone', 'Tea is ready')).toBe(false);
  });

  it('pauses a tab that is watching something, and tells it why', () => {
    const presence = createPresenceService();
    const send = vi.fn();

    presence.connect({
      clientId: 'tab-1',
      accountId: null,
      profileId: null,
      profileName: null,
      deviceLabel: 'Chrome on Mac',
      send: send,
    });
    presence.startPlayback('tab-1', PLAYBACK);

    expect(presence.pause('tab-1', 'This stream was paused by an admin.')).toBe(true);
    expect(send).toHaveBeenCalledWith({
      kind: 'paused',
      reason: 'This stream was paused by an admin.',
    });
    expect(presence.list()).toMatchObject([
      { playback: { isPlaying: false, pausedByAdmin: true } },
    ]);
  });

  it('refuses to pause a tab that is not watching anything', () => {
    const presence = createPresenceService();

    presence.connect({
      clientId: 'tab-1',
      accountId: null,
      profileId: null,
      profileName: null,
      deviceLabel: 'Chrome on Mac',
      send: vi.fn(),
    });

    expect(presence.pause('tab-1', 'paused')).toBe(false);
  });

  it('refuses to pause a tab that is not connected', () => {
    const presence = createPresenceService();

    expect(presence.pause('ghost', 'paused')).toBe(false);
  });

  it('resumes a paused tab', () => {
    const presence = createPresenceService();
    const send = vi.fn();

    presence.connect({
      clientId: 'tab-1',
      accountId: null,
      profileId: null,
      profileName: null,
      deviceLabel: 'Chrome on Mac',
      send: send,
    });
    presence.startPlayback('tab-1', PLAYBACK);
    presence.pause('tab-1', 'paused');

    expect(presence.resume('tab-1')).toBe(true);
    expect(send).toHaveBeenCalledWith({ kind: 'resumed' });
    expect(presence.list()).toMatchObject([
      { playback: { isPlaying: true, pausedByAdmin: false } },
    ]);
  });

  it('stops a tab and clears what it was watching', () => {
    const presence = createPresenceService();
    const send = vi.fn();

    presence.connect({
      clientId: 'tab-1',
      accountId: null,
      profileId: null,
      profileName: null,
      deviceLabel: 'Chrome on Mac',
      send: send,
    });
    presence.startPlayback('tab-1', PLAYBACK);

    expect(presence.stop('tab-1', 'This stream was stopped by an admin.')).toBe(true);
    expect(send).toHaveBeenCalledWith({
      kind: 'stopped',
      reason: 'This stream was stopped by an admin.',
    });
    expect(presence.list()).toEqual([expect.objectContaining({ playback: null })]);
  });

  it('refuses to stop a tab that is not connected', () => {
    const presence = createPresenceService();

    expect(presence.stop('ghost', 'stopped')).toBe(false);
  });
});

describe('the things presence is asked about tabs it does not have', () => {
  it('ignores a tab starting playback that never connected', () => {
    const presence = createPresenceService();

    presence.startPlayback('ghost', {
      mediaId: 'media-1',
      mediaTitle: 'Arrival',
      hasPoster: false,
      hasBackdrop: false,
      mode: 'direct',
      reuse: null,
      transcoderSessionId: null,
      plan,
    });

    expect(presence.list()).toEqual([]);
  });

  it('ignores a tab that stops watching without ever having connected', () => {
    const presence = createPresenceService();

    presence.stopPlayback('ghost');

    expect(presence.list()).toEqual([]);
  });

  it('ignores a heartbeat from a tab that is watching nothing', () => {
    const presence = createPresenceService();
    const said = vi.fn();

    presence.connect({
      clientId: 'tab-1',
      accountId: null,
      profileId: null,
      profileName: null,
      deviceLabel: 'Chrome',
      send: vi.fn(),
    });
    presence.watch(said);
    presence.heartbeatPlayback('tab-1', true);

    expect(said).not.toHaveBeenCalled();
  });

  it('says nothing to a watcher when a heartbeat carries no news', () => {
    const presence = createPresenceService();
    const said = vi.fn();

    presence.connect({
      clientId: 'tab-1',
      accountId: null,
      profileId: null,
      profileName: null,
      deviceLabel: 'Chrome',
      send: vi.fn(),
    });
    presence.startPlayback('tab-1', {
      mediaId: 'media-1',
      mediaTitle: 'Arrival',
      hasPoster: false,
      hasBackdrop: false,
      mode: 'direct',
      reuse: null,
      transcoderSessionId: null,
      plan,
    });

    presence.watch(said);
    presence.heartbeatPlayback('tab-1', true);

    expect(said).not.toHaveBeenCalled();
  });

  it('tells a watcher when a heartbeat says the position moved', () => {
    const presence = createPresenceService();
    const said = vi.fn();

    presence.connect({
      clientId: 'tab-1',
      accountId: null,
      profileId: null,
      profileName: null,
      deviceLabel: 'Chrome',
      send: vi.fn(),
    });
    presence.startPlayback('tab-1', {
      mediaId: 'media-1',
      mediaTitle: 'Arrival',
      hasPoster: false,
      hasBackdrop: false,
      mode: 'direct',
      reuse: null,
      transcoderSessionId: null,
      plan,
    });

    presence.watch(said);
    presence.heartbeatPlayback('tab-1', true, {
      positionSeconds: 42,
      durationSeconds: 7200,
      bufferedAheadSeconds: 10,
      presentedWidth: 1920,
      presentedHeight: 1080,
    });

    expect(said).toHaveBeenCalled();
  });
});

describe('createPresenceService, telling somebody about viewings', () => {
  const watching = () => {
    const started = vi.fn();
    const stopped = vi.fn();
    const presence = createPresenceService({
      onPlaybackStarted: started,
      onPlaybackStopped: stopped,
    });

    presence.connect({
      clientId: 'tab-1',
      accountId: 'account-1',
      profileId: 'profile-1',
      profileName: 'Dan',
      deviceLabel: 'Chrome on Mac',
      send: vi.fn(),
    });

    return { presence, started, stopped };
  };

  it('says who started watching, and on what', () => {
    const { presence, started } = watching();

    presence.startPlayback('tab-1', PLAYBACK);

    expect(started).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'account-1',
        profileId: 'profile-1',
        profileName: 'Dan',
        deviceLabel: 'Chrome on Mac',
        mediaId: 'media-1',
        mode: 'DirectPlay',
      }),
    );
  });

  it('says so when the client stops watching', () => {
    const { presence, stopped } = watching();

    presence.startPlayback('tab-1', PLAYBACK);
    presence.stopPlayback('tab-1');

    expect(stopped).toHaveBeenCalledTimes(1);
  });

  it('says so when an administrator stops it, which is not the client saying so', () => {
    const { presence, stopped } = watching();

    presence.startPlayback('tab-1', PLAYBACK);
    presence.stop('tab-1', 'That is enough of that');

    expect(stopped).toHaveBeenCalledTimes(1);
  });

  it('says so when the socket simply closes, which nothing else would report', () => {
    const { presence, stopped } = watching();

    presence.startPlayback('tab-1', PLAYBACK);
    presence.disconnect('tab-1');

    expect(stopped).toHaveBeenCalledTimes(1);
  });

  it('reports how far through it had got, which is cleared the moment it stops', () => {
    const { presence, stopped } = watching();

    presence.startPlayback('tab-1', PLAYBACK);
    presence.heartbeatPlayback('tab-1', true, {
      positionSeconds: 610,
      durationSeconds: 7200,
      bufferedAheadSeconds: 30,
      presentedWidth: 1920,
      presentedHeight: 1080,
    });
    presence.stopPlayback('tab-1');

    expect(stopped).toHaveBeenCalledWith(
      expect.objectContaining({ positionSeconds: 610, durationSeconds: 7200 }),
    );
  });

  it('says nothing about a tab that disconnects without having watched anything', () => {
    const { presence, stopped } = watching();

    presence.disconnect('tab-1');

    expect(stopped).not.toHaveBeenCalled();
  });

  it('does not report a second stop for a viewing already ended', () => {
    const { presence, stopped } = watching();

    presence.startPlayback('tab-1', PLAYBACK);
    presence.stopPlayback('tab-1');
    presence.disconnect('tab-1');

    expect(stopped).toHaveBeenCalledTimes(1);
  });
});

describe('createPresenceService, a client that asks twice', () => {
  const watching = () => {
    const started = vi.fn();
    const stopped = vi.fn();
    const presence = createPresenceService({
      onPlaybackStarted: started,
      onPlaybackStopped: stopped,
    });

    presence.connect({
      clientId: 'tab-1',
      accountId: 'account-1',
      profileId: 'profile-1',
      profileName: 'Dan',
      deviceLabel: 'Chrome on Mac',
      send: vi.fn(),
    });

    return { presence, started, stopped };
  };

  it('reports one viewing when a player asks for the same thing twice', () => {
    const { presence, started } = watching();

    presence.startPlayback('tab-1', PLAYBACK);
    presence.startPlayback('tab-1', PLAYBACK);

    expect(started).toHaveBeenCalledTimes(1);
  });

  it('keeps the moment it actually began rather than restarting the clock', () => {
    const { presence } = watching();

    presence.startPlayback('tab-1', PLAYBACK);

    const began = presence.list()[0]?.playback?.startedAt;

    presence.startPlayback('tab-1', PLAYBACK);

    expect(presence.list()[0]?.playback?.startedAt).toBe(began);
  });

  it('ends the old viewing before beginning a new one, so neither is left hanging', () => {
    const { presence, started, stopped } = watching();

    presence.startPlayback('tab-1', PLAYBACK);
    presence.startPlayback('tab-1', { ...PLAYBACK, mediaId: 'media-2' });

    expect(stopped).toHaveBeenCalledTimes(1);
    expect(started).toHaveBeenCalledTimes(2);
  });

  it('says how it is being played, in the words the sessions page uses', () => {
    const { presence, started } = watching();

    presence.startPlayback('tab-1', PLAYBACK);

    expect(started).toHaveBeenCalledWith(expect.objectContaining({ mode: 'DirectPlay' }));
  });
});
