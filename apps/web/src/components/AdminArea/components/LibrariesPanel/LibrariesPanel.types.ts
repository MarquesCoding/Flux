import type { Library } from '@FluxContracts/schemas/Library';
import type { ScanEntry } from '@FluxWeb/components/AdminArea/scanCoordinator';

type LibrariesPanelProps = {
  /**
   * Whether the list could not be read at all, as opposed to being empty.
   * The two look identical and only one of them means "add a library".
   */
  isUnreachable?: boolean;
  libraries: Library[];
  /**
   * What is being scanned right now, keyed by library.
   */
  progress: ReadonlyMap<string, ScanEntry>;
  isScanningAll: boolean;
  isResettingAll: boolean;
  /**
   * Forced, every file is read again whatever the filesystem says about it.
   */
  onScan: (libraryId: string, force?: boolean) => void;
  onScanAll: () => void;
  onResetAll: () => void;
  onRegeneratePreviews: (libraryId: string) => void;
  onLibraryCreated: (library: Library) => void;
  onLibraryUpdated: (library: Library) => void;
};

export type { LibrariesPanelProps };
