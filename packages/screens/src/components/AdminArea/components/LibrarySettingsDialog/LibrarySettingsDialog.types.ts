import type { Library } from '@FluxContracts/schemas/Library';

type LibrarySettingsDialogProps = {
  library: Library | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (library: Library) => void;
  onRegenerate: (libraryId: string) => void;
};

export type { LibrarySettingsDialogProps };
