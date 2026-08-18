import type { Concern } from '@FluxScreens/components/AdminArea/collectConcerns';

type ConcernsBannerProps = {
  concerns: Concern[];
  onOpenPanel: (panel: string) => void;
};

export type { ConcernsBannerProps };
