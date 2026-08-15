type AdminMessageOverlayProps = {
  kind: 'stopped' | 'paused';
  reason: string;
  onDismiss: () => void;
};

export type { AdminMessageOverlayProps };
