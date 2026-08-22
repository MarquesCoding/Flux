type ConnectToServerProps = {
  onConnected: (address: string) => void;
  startWith?: string;
  couldNotReach?: string;
  reach?: (address: string) => Promise<boolean>;
  found?: readonly string[];
};

export type { ConnectToServerProps };
