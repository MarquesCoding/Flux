import type { RatingSubject } from '@ValenceClient/library/fetchRatings';

type RatingPanelProps = {
  subject: RatingSubject;
  title: string;
  stars: number | null;
  onRate: (stars: number | null) => void;
  className?: string;
};

export type { RatingPanelProps };
