type Preferences = {
  held: Record<string, string>;
  write: (key: string, value: string) => void;
  forget: (key: string) => void;
};

type SignedInAccount = { id: string; email: string; name: string };

declare global {
  interface Window {
    flux: { preferences: Preferences };
    requestAuth: () => Promise<void>;
    signOut: () => Promise<void>;
    getUser: () => Promise<SignedInAccount | null>;
    onAuthenticated: (then: (user: SignedInAccount) => void) => () => void;
  }
}

export type { Preferences, SignedInAccount };
