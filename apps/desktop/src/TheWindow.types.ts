type ServersFound = {
  alreadyFound: string[];
  whenFound: (listener: (address: string) => void) => () => void;
};

type Preferences = {
  held: Record<string, string>;
  write: (key: string, value: string) => void;
  forget: (key: string) => void;
};

declare global {
  interface Window {
    flux: {
      preferences: Preferences;
      goToTheServer: () => void;
      servers?: ServersFound;
    };
  }
}

export type { Preferences, ServersFound };
