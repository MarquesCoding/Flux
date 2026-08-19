type ConnectToServerProps = {
  onConnected: (address: string) => void;
  reach?: (address: string) => Promise<boolean>;
};

export type { ConnectToServerProps };
