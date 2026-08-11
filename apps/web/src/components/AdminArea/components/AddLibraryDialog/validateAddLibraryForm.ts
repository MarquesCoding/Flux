import type { AddLibraryFormErrors } from './AddLibraryDialog.types'

type AddLibraryFormValues = {
  name: string
  path: string
}

/**
 * Validates the add-library form before it reaches the server.
 *
 * The server checks the path is a readable directory; this only catches the
 * empty-field case, so the operator is told which field is wrong rather than
 * waiting on a round trip for something checkable locally.
 */
const validateAddLibraryForm = (values: AddLibraryFormValues): AddLibraryFormErrors => {
  const errors: AddLibraryFormErrors = {}

  if (values.name.trim().length === 0) {
    errors.name = 'Enter a name for this library.'
  }

  if (values.path.trim().length === 0) {
    errors.path = 'Enter the path to this library on the machine running Flux.'
  }

  return errors
}

export type { AddLibraryFormValues }

export { validateAddLibraryForm }
