import { describePlaybackMode } from '@ValenceContracts/functions/describePlaybackMode';
import type { PlaybackMode } from '@ValenceContracts/functions/describePlaybackMode';
import type { PlaybackPlan } from '@ValenceContracts/schemas/PlaybackPlan';

type PresencePlayback = {
  mediaId: string;
  mediaTitle: string;
  hasPoster: boolean;
  hasBackdrop: boolean;
  mode: 'direct' | 'transcode';
  plan: PlaybackPlan;
  transcoderSessionId: string | null;
  isPlaying: boolean;
  pausedByAdmin: boolean;
  startedAt: number;
  health: PresencePlaybackHealth | null;
};

type PresencePlaybackHealth = {
  positionSeconds: number;
  durationSeconds: number;
  bufferedAheadSeconds: number;
  presentedWidth: number;
  presentedHeight: number;
};

type PresenceEntry = {
  clientId: string;
  accountId: string | null;
  profileId: string | null;
  profileName: string | null;
  deviceLabel: string;
  connectedAt: number;
  playback: PresencePlayback | null;
};

type PresenceViewing = {
  accountId: string | null;
  profileId: string | null;
  profileName: string | null;
  deviceLabel: string;
  mediaId: string;
  mode: PlaybackMode;
  positionSeconds: number | null;
  durationSeconds: number | null;
};

type PresenceControlEvent =
  | { kind: 'stopped'; reason: string }
  | { kind: 'paused'; reason: string }
  | { kind: 'resumed' }
  | { kind: 'message'; text: string };

type PresenceStartPlaybackInput = Omit<
  PresencePlayback,
  'isPlaying' | 'pausedByAdmin' | 'startedAt' | 'health'
>;

type PresenceWatchers = {
  onPlaybackStarted?: (viewing: PresenceViewing) => void;
  onPlaybackStopped?: (viewing: PresenceViewing) => void;
};

type PresenceArrival = {
  clientId: string;
  accountId?: string | null;
  profileId: string | null;
  profileName: string | null;
  deviceLabel: string;
  send: (event: PresenceControlEvent) => void;
};

type PresenceService = {
  connect: (arrival: PresenceArrival) => void;
  disconnect: (clientId: string) => void;
  startPlayback: (clientId: string, playback: PresenceStartPlaybackInput) => void;
  stopPlayback: (clientId: string) => void;
  heartbeatPlayback: (
    clientId: string,
    isPlaying: boolean,
    health?: PresencePlaybackHealth,
  ) => void;
  list: () => PresenceEntry[];
  watch: (listener: () => void) => () => void;
  pause: (clientId: string, reason: string) => boolean;
  message: (clientId: string, text: string) => boolean;
  resume: (clientId: string) => boolean;
  stop: (clientId: string, reason: string) => boolean;
};

type Connection = {
  entry: PresenceEntry;
  send: (event: PresenceControlEvent) => void;
};

/**
 * Who has the app open, held in memory rather than in Postgres. Presence is true only while a
 * connection is open, so it has nothing to survive a restart for — a server that has just come back
 * has no connections, and that is the honest answer.
 */
const createPresenceService = (watchers: PresenceWatchers = {}): PresenceService => {
  const connections = new Map<string, Connection>();
  const listeners = new Set<() => void>();

  const announce = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  /**
   * Describes what one connection is watching, for whoever is being told about viewings.
   *
   * @param entry - The connection.
   * @param playback - What it is playing.
   * @returns The viewing.
   */
  const viewing = (entry: PresenceEntry, playback: PresencePlayback): PresenceViewing => ({
    accountId: entry.accountId,
    profileId: entry.profileId,
    profileName: entry.profileName,
    deviceLabel: entry.deviceLabel,
    mediaId: playback.mediaId,
    mode: describePlaybackMode(playback.plan),
    positionSeconds: playback.health?.positionSeconds ?? null,
    durationSeconds: playback.health?.durationSeconds ?? null,
  });

  /**
   * Ends whatever a connection was playing and says so once.
   *
   * Every way a viewing can end comes through here — the client saying so, an administrator stopping
   * it, and the socket simply closing. A viewing reported as started and never as stopped is worse
   * than one never reported at all, so there is one place that clears it rather than three.
   *
   * @param connection - Whose playback to end.
   */
  const endPlayback = (connection: Connection) => {
    const playback = connection.entry.playback;

    if (playback === null) {
      return;
    }

    connection.entry.playback = null;
    watchers.onPlaybackStopped?.(viewing(connection.entry, playback));
  };

  return {
    connect: ({ clientId, accountId = null, profileId, profileName, deviceLabel, send }) => {
      connections.set(clientId, {
        entry: {
          clientId,
          accountId,
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
      const connection = connections.get(clientId);

      if (connection !== undefined) {
        endPlayback(connection);
      }

      connections.delete(clientId);
      announce();
    },

    startPlayback: (clientId, playback) => {
      const connection = connections.get(clientId);

      if (connection === undefined) {
        return;
      }

      const already = connection.entry.playback;
      const isTheSameViewing = already !== null && already.mediaId === playback.mediaId;

      if (already !== null && !isTheSameViewing) {
        endPlayback(connection);
      }

      const started = {
        ...playback,
        isPlaying: true,
        pausedByAdmin: false,
        startedAt: isTheSameViewing ? already.startedAt : Date.now(),
        health: isTheSameViewing ? already.health : null,
      };

      connection.entry.playback = started;

      if (!isTheSameViewing) {
        watchers.onPlaybackStarted?.(viewing(connection.entry, started));
      }

      announce();
    },

    stopPlayback: (clientId) => {
      const connection = connections.get(clientId);

      if (connection !== undefined) {
        endPlayback(connection);
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

    message: (clientId, text) => {
      const connection = connections.get(clientId);

      if (connection === undefined) {
        return false;
      }

      connection.send({ kind: 'message', text });

      return true;
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

      endPlayback(connection);
      connection.send({ kind: 'stopped', reason });
      announce();

      return true;
    },
  };
};

export type { PresenceArrival, PresenceService, PresenceViewing, PresenceWatchers };

export { createPresenceService };
