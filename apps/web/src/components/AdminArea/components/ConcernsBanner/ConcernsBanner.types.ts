import type { Concern } from '@FluxWeb/components/AdminArea/collectConcerns';

type ConcernsBannerProps = {
  concerns: Concern[];
  /**
   * Told which section explains the thing that was pressed.
   */
  onOpenPanel: (panel: string) => void;
};

export type { ConcernsBannerProps };
