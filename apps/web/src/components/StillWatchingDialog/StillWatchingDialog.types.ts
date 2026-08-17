type StillWatchingDialogProps = {
  isOpen: boolean;
  title: string;
  secondsToAnswer: number;
  onCarryOn: () => void;
  onGiveUp: () => void;
};

export type { StillWatchingDialogProps };
