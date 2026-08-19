type Preferences = {
  held: Record<string, string>;
  write: (key: string, value: string) => void;
  forget: (key: string) => void;
};

type FluxBridge = {
  preferences: Preferences;
};

declare global {
  interface Window {
    flux: FluxBridge;
  }
}

export type { FluxBridge, Preferences };
