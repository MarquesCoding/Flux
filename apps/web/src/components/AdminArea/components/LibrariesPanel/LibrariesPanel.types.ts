import type { Library } from '@FluxContracts/schemas/Library';
import type { ScanEntry } from '@FluxWeb/components/AdminArea/scanCoordinator';

type LibrariesPanelProps = {
  libraries: Library[];
  /**
   * What is being scanned right now, keyed by library.
   */
  progress: ReadonlyMap<string, ScanEntry>;
  isScanningAll: boolean;
  isResettingAll: boolean;
  onScan: (libraryId: string) => void;
  onScanAll: () => void;
  onResetAll: () => void;
  onRegeneratePreviews: (libraryId: string) => void;
  onLibraryCreated: (library: Library) => void;
  onLibraryUpdated: (library: Library) => void;
};

export type { LibrariesPanelProps };
