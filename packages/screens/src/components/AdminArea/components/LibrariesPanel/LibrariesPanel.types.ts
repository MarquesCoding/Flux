import type { Library } from '@ValenceContracts/schemas/Library';
import type { ScanEntry } from '@ValenceScreens/components/AdminArea/scanCoordinator';

type LibrariesPanelProps = {
  isUnreachable?: boolean;
  libraries: Library[];
  progress: ReadonlyMap<string, ScanEntry>;
  isScanningAll: boolean;
  isResettingAll: boolean;
  onScan: (libraryId: string, force?: boolean) => void;
  onScanAll: () => void;
  onResetAll: () => void;
  onRegeneratePreviews: (libraryId: string) => void;
  onLibraryCreated: (library: Library) => void;
  onLibraryUpdated: (library: Library) => void;
};

export type { LibrariesPanelProps };
