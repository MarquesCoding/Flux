type ConnectToServerProps = {
  onConnected: (address: string) => void;
  startWith?: string;
  couldNotReach?: string;
  reach?: (address: string) => Promise<boolean>;
};

export type { ConnectToServerProps };
