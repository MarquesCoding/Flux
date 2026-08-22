import type { Concern } from '@ValenceScreens/components/AdminArea/collectConcerns';

type ConcernsBannerProps = {
  concerns: Concern[];
  onOpenPanel: (panel: string) => void;
};

export type { ConcernsBannerProps };
