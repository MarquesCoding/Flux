import type { AddLibraryFormErrors } from './AddLibraryDialog.types';

type AddLibraryFormValues = {
  name: string;
  path: string;
};

/**
 * Checks the add-library form before it reaches the server, so an empty name or path is caught as it
 * is typed. The server checks the same things, and also whether the path exists, which this cannot.
 *
 * @param values - What has been filled in.
 * @returns What is wrong, by field, or nothing where the form is good.
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

export { validateAddLibraryForm };
