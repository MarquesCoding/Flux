import type { Library } from '@FluxContracts/schemas/Library';

type AddLibraryDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (library: Library) => void;
};

type AddLibraryFormErrors = {
  name?: string;
  path?: string;
  submit?: string;
};

export type { AddLibraryDialogProps, AddLibraryFormErrors };
