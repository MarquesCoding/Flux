import type { ReactNode } from 'react';

type MediaCardShape = 'poster' | 'wide';

type MediaCardEmphasis = 'lead' | 'standard';

type MediaCardProps = {
  title: string;
  eyebrow?: ReactNode;
  subtitle: ReactNode;
  badges?: string[];
  imageUrl?: string;
  shape?: MediaCardShape;
  emphasis?: MediaCardEmphasis;
  watchedFraction?: number;
  onSelect: () => void;
  isStill?: boolean;
  className?: string;
};

export type { MediaCardEmphasis, MediaCardProps, MediaCardShape };
