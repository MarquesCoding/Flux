type StarRatingSize = 'sm' | 'md' | 'lg';

type StarRatingProps = {
  stars: number | null;
  label: string;
  onRate?: (stars: number) => void;
  onClear?: () => void;
  size?: StarRatingSize;
  isDisabled?: boolean;
  className?: string;
};

export type { StarRatingProps, StarRatingSize };
