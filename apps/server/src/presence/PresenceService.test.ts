import { describe, expect, it, vi } from 'vitest';
import { createPresenceService } from './PresenceService';
import type { PlaybackPlan, Reason } from '@FluxContracts/schemas/PlaybackPlan';

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

    presence.connect('tab-1', 'profile-1', 'Dan', 'Chrome on Mac', vi.fn());

    expect(presence.list()).toEqual([
      expect.objectContaining({ clientId: 'tab-1', profileName: 'Dan', playback: null }),
    ]);
  });

  it('forgets a tab once it disconnects', () => {
    const presence = createPresenceService();

    presence.connect('tab-1', null, null, 'Chrome on Mac', vi.fn());
    presence.disconnect('tab-1');

    expect(presence.list()).toEqual([]);
  });

  it('shows what a tab starts watching', () => {
    const presence = createPresenceService();

    presence.connect('tab-1', null, null, 'Chrome on Mac', vi.fn());
    presence.startPlayback('tab-1', PLAYBACK);

    expect(presence.list()).toMatchObject([
      { playback: { mediaTitle: 'Arrival', isPlaying: true } },
    ]);
  });

  it('clears playback once a tab stops watching', () => {
    const presence = createPresenceService();

    presence.connect('tab-1', null, null, 'Chrome on Mac', vi.fn());
    presence.startPlayback('tab-1', PLAYBACK);
    presence.stopPlayback('tab-1');

    expect(presence.list()).toEqual([expect.objectContaining({ playback: null })]);
  });

  it('records whether a tab is actually playing', () => {
    const presence = createPresenceService();

    presence.connect('tab-1', null, null, 'Chrome on Mac', vi.fn());
    presence.startPlayback('tab-1', PLAYBACK);
    presence.heartbeatPlayback('tab-1', false);

    expect(presence.list()).toMatchObject([{ playback: { isPlaying: false } }]);
  });

  it('has no health to report until a heartbeat carries one', () => {
    const presence = createPresenceService();

    presence.connect('tab-1', null, null, 'Chrome on Mac', vi.fn());
    presence.startPlayback('tab-1', PLAYBACK);

    expect(presence.list()).toMatchObject([{ playback: { health: null } }]);
  });

  it('records what the player reports about buffer and picture size', () => {
    const presence = createPresenceService();

    presence.connect('tab-1', null, null, 'Chrome on Mac', vi.fn());
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

  it('pauses a tab that is watching something, and tells it why', () => {
    const presence = createPresenceService();
    const send = vi.fn();

    presence.connect('tab-1', null, null, 'Chrome on Mac', send);
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

    presence.connect('tab-1', null, null, 'Chrome on Mac', vi.fn());

    expect(presence.pause('tab-1', 'paused')).toBe(false);
  });

  it('refuses to pause a tab that is not connected', () => {
    const presence = createPresenceService();

    expect(presence.pause('ghost', 'paused')).toBe(false);
  });

  it('resumes a paused tab', () => {
    const presence = createPresenceService();
    const send = vi.fn();

    presence.connect('tab-1', null, null, 'Chrome on Mac', send);
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

    presence.connect('tab-1', null, null, 'Chrome on Mac', send);
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

    presence.connect('tab-1', null, null, 'Chrome', vi.fn());
    presence.watch(said);
    presence.heartbeatPlayback('tab-1', true);

    expect(said).not.toHaveBeenCalled();
  });

  it('says nothing to a watcher when a heartbeat carries no news', () => {
    const presence = createPresenceService();
    const said = vi.fn();

    presence.connect('tab-1', null, null, 'Chrome', vi.fn());
    presence.startPlayback('tab-1', {
      mediaId: 'media-1',
      mediaTitle: 'Arrival',
      hasPoster: false,
      hasBackdrop: false,
      mode: 'direct',
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

    presence.connect('tab-1', null, null, 'Chrome', vi.fn());
    presence.startPlayback('tab-1', {
      mediaId: 'media-1',
      mediaTitle: 'Arrival',
      hasPoster: false,
      hasBackdrop: false,
      mode: 'direct',
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
