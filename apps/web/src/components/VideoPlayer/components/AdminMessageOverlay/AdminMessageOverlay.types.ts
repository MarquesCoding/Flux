type AdminMessageOverlayProps = {
  kind: 'stopped' | 'paused' | 'message';
  text: string;
  onDismiss: () => void;
};

export type { AdminMessageOverlayProps };
