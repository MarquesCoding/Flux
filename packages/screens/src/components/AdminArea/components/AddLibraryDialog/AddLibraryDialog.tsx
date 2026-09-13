import { useState } from 'react';
import { Button } from '@ValenceUI/Button';
import { Dialog } from '@ValenceUI/Dialog';
import { DialogContent } from '@ValenceUI/DialogContent';
import { DialogFooter } from '@ValenceUI/DialogFooter';
import { DialogTitle } from '@ValenceUI/DialogTitle';
import { TextField } from '@ValenceUI/TextField';
import { Icon } from '@ValenceUI/Icon';
import { Folder01Icon } from '@hugeicons/core-free-icons';
import { FolderBrowser } from '@ValenceScreens/components/AdminArea/components/FolderBrowser/FolderBrowser';
import { SELECTABLE_LIBRARY_KINDS } from '@ValenceContracts/schemas/Library';
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
 * The folder can be typed or found: browsing walks the server's own folders, since a path typed from
 * memory on a machine somebody is not sitting at is the easiest thing here to get wrong.
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
  const [isBrowsing, setIsBrowsing] = useState(false);

  const reset = () => {
    setName('');
    setKind('movies');
    setPath('');
    setErrors({});
    setIsBrowsing(false);
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
            {SELECTABLE_LIBRARY_KINDS.map((entry) => (
              <Button
                key={entry}
                size="sm"
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

        <div className="flex flex-col gap-3">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <TextField
                label="Path"
                value={path}
                onValueChange={setPath}
                placeholder="/media/movies"
                description="A folder on the machine running Valence, not your browser."
                {...(errors.path === undefined ? {} : { error: errors.path })}
              />
            </div>

            {isBrowsing ? null : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsBrowsing(true);
                }}
              >
                <Icon of={Folder01Icon} size={14} />
                Browse
              </Button>
            )}
          </div>

          {isBrowsing ? (
            <FolderBrowser
              start={path}
              onChoose={(chosen) => {
                setPath(chosen);
                setIsBrowsing(false);
              }}
              onCancel={() => {
                setIsBrowsing(false);
              }}
            />
          ) : null}
        </div>

        {errors.submit === undefined ? null : (
          <p role="alert" className="text-sm text-danger">
            {errors.submit}
          </p>
        )}
      </DialogContent>

      <DialogFooter>
        <Button variant="secondary" onClick={close} disabled={isSubmitting}>
          Cancel
        </Button>

        <Button
          variant="primary"
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
