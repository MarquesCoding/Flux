import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';

type ServersFound = {
  alreadyFound: string[];
  whenFound: (listener: (address: string) => void) => () => void;
};

type Preferences = {
  held: Record<string, string>;
  write: (key: string, value: string) => void;
  forget: (key: string) => void;
};

type FilesHeld = {
  all: () => Promise<JsonValue>;
  keep: (what: JsonValue) => Promise<void>;
  drop: (downloadId: string) => Promise<void>;
  pause: (downloadId: string, isPaused: boolean) => Promise<void>;
  whenChanged: (listener: (held: JsonValue) => void) => () => void;
};

type Reach = {
  now: boolean;
  whenChanged: (listener: (isReachable: boolean) => void) => () => void;
};

declare global {
  interface Window {
    valence: {
      preferences: Preferences;
      goToTheServer: () => void;
      held: FilesHeld;
      reach: Reach;
      servers?: ServersFound;
    };
  }
}

export type { FilesHeld, Preferences, Reach, ServersFound };
