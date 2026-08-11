import { useState } from 'react'
import ButtonModule from '@FluxUI/Button'
import DialogModule from '@FluxUI/Dialog'
import TextFieldModule from '@FluxUI/TextField'
import LibraryContract from '@FluxContracts/schemas/Library'
import fetchLibraryModule from '@FluxWeb/library/fetchLibrary'
import validateAddLibraryFormModule from './validateAddLibraryForm'
import type { LibraryKind } from '@FluxContracts/schemas/Library'
import type { AddLibraryDialogProps, AddLibraryFormErrors } from './AddLibraryDialog.types'

const { Button } = ButtonModule
const { Dialog } = DialogModule
const { TextField } = TextFieldModule
const { LIBRARY_KINDS } = LibraryContract
const { createLibrary } = fetchLibraryModule
const { validateAddLibraryForm } = validateAddLibraryFormModule

const KIND_LABELS: Record<LibraryKind, string> = {
  movies: 'Movies',
  shows: 'Shows',
  music: 'Music',
}

/**
 * Adds a library root.
 *
 * The path is a location on the machine running Flux, not the browser, which
 * is easy to forget on a desktop reaching a server elsewhere on the network.
 */
const AddLibraryDialog = ({ isOpen, onClose, onCreated }: AddLibraryDialogProps) => {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<LibraryKind>('movies')
  const [path, setPath] = useState('')
  const [errors, setErrors] = useState<AddLibraryFormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reset = () => {
    setName('')
    setKind('movies')
    setPath('')
    setErrors({})
  }

  const close = () => {
    reset()
    onClose()
  }

  const submit = async () => {
    const found = validateAddLibraryForm({ name, path })

    setErrors(found)

    if (Object.keys(found).length > 0) {
      return
    }

    setIsSubmitting(true)

    try {
      const library = await createLibrary({ name, kind, path })

      onCreated(library)
      reset()
    } catch (error) {
      setErrors({
        submit: error instanceof Error ? error.message : 'The library could not be added.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog label="Add a library" isOpen={isOpen} onClose={close}>
      <div className="flex flex-col gap-5 p-6">
        <h2 className="text-lg font-medium text-text">Add a library</h2>

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
                  setKind(entry)
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
          description="A folder on the machine running Flux, not your browser."
          {...(errors.path === undefined ? {} : { error: errors.path })}
        />

        {errors.submit === undefined ? null : (
          <p role="alert" className="text-sm text-danger">
            {errors.submit}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" isPill onClick={close} disabled={isSubmitting}>
            Cancel
          </Button>

          <Button
            variant="glossy"
            isPill
            isLoading={isSubmitting}
            onClick={() => {
              void submit()
            }}
          >
            Add library
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

AddLibraryDialog.displayName = 'AddLibraryDialog'

export default { AddLibraryDialog }
