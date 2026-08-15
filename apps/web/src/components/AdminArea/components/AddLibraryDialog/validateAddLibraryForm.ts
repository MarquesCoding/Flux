import type { AddLibraryFormErrors } from './AddLibraryDialog.types';

type AddLibraryFormValues = {
  name: string;
  path: string;
};

/**
 * Validates the add-library form before it reaches the server.
 */
const validateAddLibraryForm = (values: AddLibraryFormValues): AddLibraryFormErrors => {
  const errors: AddLibraryFormErrors = {};

  if (values.name.trim().length === 0) {
    errors.name = 'Enter a name for this library.';
  }

  if (values.path.trim().length === 0) {
    errors.path = 'Enter the path to this library on the machine running Flux.';
  }

  return errors;
};

export type { AddLibraryFormValues };

export { validateAddLibraryForm };
