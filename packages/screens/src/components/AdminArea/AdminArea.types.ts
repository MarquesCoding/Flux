type AdminAreaProps = {
  historyLength?: number;
  initialPanel?: string | null;
  onPanelChange?: (panel: string) => void;
  initialJob?: string | null;
  onJobChange?: (kind: string | null) => void;
};

export type { AdminAreaProps };
