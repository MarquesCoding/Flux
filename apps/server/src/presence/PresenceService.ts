import type { PlaybackPlan } from '@FluxContracts/schemas/PlaybackPlan';

/**
 * What a tab is doing, once it has started watching something.
 */
type PresencePlayback = {
  mediaId: string;
  mediaTitle: string;
  hasPoster: boolean;
  hasBackdrop: boolean;
  mode: 'direct' | 'transcode';
  /**
   * What was negotiated for this session, axis by axis — the same plan the
   * viewer's own player can explain itself from, for an admin looking at
   * this stream to see exactly the same thing.
   */
  plan: PlaybackPlan;
  /**
   * The transcoder's own session id, when this is a transcode.
   *
   * Needed to stop the underlying ffmpeg process on an admin Stop — direct
   * play has nothing running server-side to stop.
   */
  transcoderSessionId: string | null;
  isPlaying: boolean;
  pausedByAdmin: boolean;
  startedAt: number;
  /**
   * What the viewer's own player last reported about itself, for an admin
   * looking at this stream to see. Null until the first heartbeat carrying
   * it arrives — up to `HEARTBEAT_INTERVAL_MILLISECONDS` after playback
   * starts, the same client-side constant `VideoPlayer` heartbeats on.
   */
  health: PresencePlaybackHealth | null;
};

/**
 * What a viewer's player reports about how the stream is actually running.
 *
 * Read from the player itself, not measured server-side — the server has no
 * way to see a browser's buffer or decoded resolution any other way.
 */
type PresencePlaybackHealth = {
  /**
   * Where the viewer is in the film, and how long it is — the pair a
   * progress bar needs. Absolute, on the media's own timeline, not relative
   * to where this session began.
   */
  positionSeconds: number;
  durationSeconds: number;
  bufferedAheadSeconds: number;
  presentedWidth: number;
  presentedHeight: number;
};

/**
 * One open tab.
 *
 * Exists for as long as its SSE connection does — there is no separate
 * timeout, because the connection itself is the liveness signal.
 */
type PresenceEntry = {
  clientId: string;
  profileId: string | null;
  profileName: string | null;
  deviceLabel: string;
  connectedAt: number;
  playback: PresencePlayback | null;
};

/**
 * A control message pushed down a tab's own presence connection.
 */
type PresenceControlEvent =
  { kind: 'stopped'; reason: string } | { kind: 'paused'; reason: string } | { kind: 'resumed' };

type PresenceStartPlaybackInput = Omit<
  PresencePlayback,
  'isPlaying' | 'pausedByAdmin' | 'startedAt' | 'health'
>;

/**
 * Who has the app open right now, and what they are watching.
 *
 * Independent of the transcoder's own session registry on purpose: a direct
 * play never touches the transcoder at all, and someone browsing the library
 * with nothing playing has no session there either. This is the one place
 * that knows about every open tab, whether or not it is playing anything.
 */
type PresenceService = {
  /**
   * Registers a tab's connection and how to push events to it.
   *
   * `send` is the SSE route's own enqueue function — kept rather than a
   * reference to the response, so this module stays free of anything
   * transport-shaped.
   */
  connect: (
    clientId: string,
    profileId: string | null,
    profileName: string | null,
    deviceLabel: string,
    send: (event: PresenceControlEvent) => void,
  ) => void;
  disconnect: (clientId: string) => void;
  startPlayback: (clientId: string, playback: PresenceStartPlaybackInput) => void;
  stopPlayback: (clientId: string) => void;
  heartbeatPlayback: (
    clientId: string,
    isPlaying: boolean,
    health?: PresencePlaybackHealth,
  ) => void;
  list: () => PresenceEntry[];
  /**
   * Tells a listener whenever who is about, or what they are doing, changes.
   *
   * For pushing the session list to an admin rather than having the page ask
   * every few seconds. Returns the way to stop listening; a watcher that
   * outlives its connection keeps a closed response alive.
   *
   * A heartbeat only counts as a change when it says something new — playing
   * became paused, or the position moved. Otherwise a room of viewers would
   * push several times a second and the stream would be a poll with extra
   * steps.
   */
  watch: (listener: () => void) => () => void;
  /**
   * Pushes a pause to a tab and marks it paused-by-admin.
   *
   * `false` when the tab is not connected or nothing is playing there.
   */
  pause: (clientId: string, reason: string) => boolean;
  /**
   * Pushes a resume and clears paused-by-admin.
   *
   * `false` when the tab is not connected.
   */
  resume: (clientId: string) => boolean;
  /**
   * Pushes a stop and clears the tab's playback.
   *
   * `false` when the tab is not connected. The caller is responsible for
   * stopping the underlying transcode, if any — this only updates presence
   * and notifies the viewer.
   */
  stop: (clientId: string, reason: string) => boolean;
};

type Connection = {
  entry: PresenceEntry;
  send: (event: PresenceControlEvent) => void;
};

/**
 * Presence held in memory.
 *
 * A single process's own view of who is connected, which is all a single-box
 * deployment needs — the same scope the transcoder's own session registry
 * already has. See ADR-0006.
 */
const createPresenceService = (): PresenceService => {
  const connections = new Map<string, Connection>();
  const listeners = new Set<() => void>();

  const announce = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    connect: (clientId, profileId, profileName, deviceLabel, send) => {
      connections.set(clientId, {
        entry: {
          clientId,
          profileId,
          profileName,
          deviceLabel,
          connectedAt: Date.now(),
          playback: null,
        },
        send,
      });

      announce();
    },

    disconnect: (clientId) => {
      connections.delete(clientId);
      announce();
    },

    startPlayback: (clientId, playback) => {
      const connection = connections.get(clientId);

      if (connection === undefined) {
        return;
      }

      connection.entry.playback = {
        ...playback,
        isPlaying: true,
        pausedByAdmin: false,
        startedAt: Date.now(),
        health: null,
      };

      announce();
    },

    stopPlayback: (clientId) => {
      const connection = connections.get(clientId);

      if (connection !== undefined) {
        connection.entry.playback = null;
        announce();
      }
    },

    heartbeatPlayback: (clientId, isPlaying, health) => {
      const playback = connections.get(clientId)?.entry.playback;

      if (playback === null || playback === undefined) {
        return;
      }

      const wasSaying = `${String(playback.isPlaying)}:${String(playback.health?.positionSeconds)}`;

      playback.isPlaying = isPlaying;

      if (health !== undefined) {
        playback.health = health;
      }

      if (wasSaying !== `${String(isPlaying)}:${String(playback.health?.positionSeconds)}`) {
        announce();
      }
    },

    list: () => Array.from(connections.values(), (connection) => connection.entry),

    watch: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    pause: (clientId, reason) => {
      const connection = connections.get(clientId);

      if (connection === undefined || connection.entry.playback === null) {
        return false;
      }

      connection.entry.playback.isPlaying = false;
      connection.entry.playback.pausedByAdmin = true;
      connection.send({ kind: 'paused', reason });
      announce();

      return true;
    },

    resume: (clientId) => {
      const connection = connections.get(clientId);

      if (connection === undefined) {
        return false;
      }

      if (connection.entry.playback !== null) {
        connection.entry.playback.pausedByAdmin = false;
        connection.entry.playback.isPlaying = true;
      }

      connection.send({ kind: 'resumed' });
      announce();

      return true;
    },

    stop: (clientId, reason) => {
      const connection = connections.get(clientId);

      if (connection === undefined) {
        return false;
      }

      connection.entry.playback = null;
      connection.send({ kind: 'stopped', reason });
      announce();

      return true;
    },
  };
};

export type {
  PresenceControlEvent,
  PresenceEntry,
  PresencePlayback,
  PresencePlaybackHealth,
  PresenceService,
};

export { createPresenceService };
