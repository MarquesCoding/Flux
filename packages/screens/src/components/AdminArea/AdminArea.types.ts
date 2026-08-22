type AdminAreaProps = {
  panel: string;
  onPanel: (panel: string) => void;
  historyLength?: number;
  initialJob?: string | null;
  onJobChange?: (kind: string | null) => void;
};

export type { AdminAreaProps };
