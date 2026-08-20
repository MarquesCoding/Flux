type Preferences = {
  held: Record<string, string>;
  write: (key: string, value: string) => void;
  forget: (key: string) => void;
};

declare global {
  interface Window {
    flux: { preferences: Preferences; goToTheServer: () => void };
  }
}

export type { Preferences };
