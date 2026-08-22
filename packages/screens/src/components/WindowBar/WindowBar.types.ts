type WindowBarProps = {
  name: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
};

export type { WindowBarProps };
