import type { Download } from '@ValenceContracts/schemas/Download';
import type { HeldFile } from '@ValenceContracts/schemas/HeldFile';

type KeepingControlsProps = {
  download: Download;
  held: HeldFile | null;
};

export type { KeepingControlsProps };
