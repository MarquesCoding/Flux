import { useState } from 'react';
import { Button } from '@ValenceUI/Button';
import { Dialog } from '@ValenceUI/Dialog';
import { DialogContent } from '@ValenceUI/DialogContent';
import { DialogFooter } from '@ValenceUI/DialogFooter';
import { DialogTitle } from '@ValenceUI/DialogTitle';
import { TextField } from '@ValenceUI/TextField';
import { LIBRARY_KINDS } from '@ValenceContracts/schemas/Library';
import { createLibrary } from '@ValenceClient/library/fetchLibrary';
import { validateAddLibraryForm } from './validateAddLibraryForm';
import type { LibraryKind } from '@ValenceContracts/schemas/Library';
import type { AddLibraryDialogProps, AddLibraryFormErrors } from './AddLibraryDialog.types';

const KIND_LABELS: Record<LibraryKind, string> = {
  movies: 'Movies',
  shows: 'Shows',
  music: 'Music',
  books: 'Books',
};

/**
 * Adds a library: what to call it, and the folder on the machine running Valence that holds it. Does not
 * scan it — adding is quick and scanning is not, so the two are separate gestures.
 *
 * @param isOpen - Whether the dialog is showing.
 * @param onClose - Called when it is dismissed.
 * @param onCreated - Called with the library once the server has made it.
 */
const AddLibraryDialog = ({ isOpen, onClose, onCreated }: AddLibraryDialogProps) => {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<LibraryKind>('movies');
  const [path, setPath] = useState('');
  const [errors, setErrors] = useState<AddLibraryFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setName('');
    setKind('movies');
    setPath('');
    setErrors({});
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    const found = validateAddLibraryForm({ name, path });

    setErrors(found);

    if (Object.keys(found).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const library = await createLibrary({ name, kind, path });

      onCreated(library);
      reset();
    } catch (error) {
      setErrors({
        submit: error instanceof Error ? error.message : 'The library could not be added.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog label="Add a library" isOpen={isOpen} onClose={close}>
      <DialogTitle title="Add a library" />

      <DialogContent className="flex flex-col gap-5">
        <TextField
          label="Name"
          value={name}
          onValueChange={setName}
          {...(errors.name === undefined ? {} : { error: errors.name })}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-text">Kind</legend>

          <div className="flex flex-wrap gap-2">
            {LIBRARY_KINDS.map((entry) => (
              <Button
                key={entry}
                size="sm"
                isPill
                variant={entry === kind ? 'primary' : 'secondary'}
                aria-pressed={entry === kind}
                onClick={() => {
                  setKind(entry);
                }}
              >
                {KIND_LABELS[entry]}
              </Button>
            ))}
          </div>
        </fieldset>

        <TextField
          label="Path"
          value={path}
          onValueChange={setPath}
          placeholder="/media/movies"
          description="A folder on the machine running Valence, not your browser."
          {...(errors.path === undefined ? {} : { error: errors.path })}
        />

        {errors.submit === undefined ? null : (
          <p role="alert" className="text-sm text-danger">
            {errors.submit}
          </p>
        )}
      </DialogContent>

      <DialogFooter>
        <Button variant="secondary" isPill onClick={close} disabled={isSubmitting}>
          Cancel
        </Button>

        <Button
          variant="glossy"
          isPill
          isLoading={isSubmitting}
          onClick={() => {
            void submit();
          }}
        >
          Add library
        </Button>
      </DialogFooter>
    </Dialog>
  );
};

AddLibraryDialog.displayName = 'AddLibraryDialog';

export { AddLibraryDialog };
