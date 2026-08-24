import type { HeldFile } from '@ValenceContracts/schemas/HeldFile';

type OfflinePlayerProps = {
  file: HeldFile;
  startAtSeconds?: number;
  onLeave: () => void;
  onProgress?: (positionSeconds: number, durationSeconds: number) => void;
};

export type { OfflinePlayerProps };
