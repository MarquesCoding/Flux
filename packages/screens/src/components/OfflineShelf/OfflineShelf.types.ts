import type { HeldFile } from '@ValenceContracts/schemas/HeldFile';

type OfflineShelfProps = {
  held: HeldFile[];
  onWatch: (file: HeldFile) => void;
  onDrop: (file: HeldFile) => void;
  onPause: (file: HeldFile, isPaused: boolean) => void;
};

export type { OfflineShelfProps };
