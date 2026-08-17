import type { PlaybackPlan } from '@FluxContracts/schemas/PlaybackPlan';

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
  profileId: string | null;
  profileName: string | null;
  deviceLabel: string;
  connectedAt: number;
  playback: PresencePlayback | null;
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

type PresenceService = {
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

      connection.entry.playback = null;
      connection.send({ kind: 'stopped', reason });
      announce();

      return true;
    },
  };
};

export type { PresenceService };

export { createPresenceService };
