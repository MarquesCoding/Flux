import { useState } from 'react';
import { IconSelector } from '@tabler/icons-react';
import { Button } from '@FluxUI/Button';
import { Dialog } from '@FluxUI/Dialog';
import { DialogContent } from '@FluxUI/DialogContent';
import { DialogTitle } from '@FluxUI/DialogTitle';
import { OptionMenu } from '@FluxUI/OptionMenu';
import { readLanguage, LANGUAGE_NAMES } from '@FluxCore/functions/describeTrack';
import { updateLibrary } from '@FluxWeb/library/fetchLibrary';
import type { Library } from '@FluxContracts/schemas/Library';
import type { LibrarySettingsDialogProps } from './LibrarySettingsDialog.types';

/**
 * Stands in for "no forced language" in the menu, which otherwise only deals
 * in language codes.
 */
const NONE_ID = 'none';

type LanguageOption = { id: string; label: string; detail?: string };

/**
 * The language picker's options, with the browser's own language pinned to
 * the top when it is one Flux recognises.
 */
const buildLanguageOptions = (): LanguageOption[] => {
  const primarySubtag =
    typeof navigator === 'undefined' ? null : (navigator.language.split('-')[0] ?? null);
  const browserLanguage = readLanguage(primarySubtag);
  const entries = Object.entries(LANGUAGE_NAMES).sort((a, b) => a[1].localeCompare(b[1]));
  const browserEntry = entries.find(([code]) => code === browserLanguage);
  const rest = entries.filter(([code]) => code !== browserLanguage);
  const ordered = browserEntry === undefined ? rest : [browserEntry, ...rest];

  return [
    { id: NONE_ID, label: "Each file's own default" },
    ...ordered.map(([code, label]) => ({
      id: code,
      label,
      ...(code === browserLanguage ? { detail: 'Your browser' } : {}),
    })),
  ];
};

/**
 * A library's settings, opened from clicking its name.
 *
 * Seeded with "Force default audio track" — the first of what the admin
 * Library panel is meant to grow into over time — laid out as a stack of
 * sections so more can be added later without restructuring it.
 *
 * Mount this with `key={library?.id}` from the caller: a fresh library
 * deserves fresh form state rather than whatever the last one left behind.
 */
const LibrarySettingsDialog = ({
  library,
  isOpen,
  onClose,
  onUpdated,
  onRegenerate,
}: LibrarySettingsDialogProps) => {
  const languageOptions = buildLanguageOptions();

  const [selected, setSelected] = useState(library?.defaultAudioLanguage ?? NONE_ID);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ saved: Library; label: string } | null>(null);

  const reset = () => {
    setSelected(library?.defaultAudioLanguage ?? NONE_ID);
    setError(null);
    setConfirming(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const finish = (updated: Library) => {
    onUpdated(updated);
    reset();
    onClose();
  };

  const save = async () => {
    if (library === null) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const defaultAudioLanguage = selected === NONE_ID ? null : selected;
      const changed = defaultAudioLanguage !== (library.defaultAudioLanguage ?? null);
      const updated = await updateLibrary(library.id, { defaultAudioLanguage });

      if (changed && library.itemCount > 0) {
        const label = languageOptions.find((option) => option.id === selected)?.label ?? selected;

        setConfirming({ saved: updated, label });
      } else {
        finish(updated);
      }
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'The library could not be updated.');
    } finally {
      setIsSaving(false);
    }
  };

  const regenerate = () => {
    if (confirming === null) {
      return;
    }

    onRegenerate(confirming.saved.id);
    finish(confirming.saved);
  };

  if (library === null) {
    return null;
  }

  const selectedLabel = languageOptions.find((option) => option.id === selected)?.label ?? selected;

  return (
    <Dialog label={`${library.name} settings`} isOpen={isOpen} onClose={close}>
      <DialogTitle title={library.name} />

      <DialogContent className="flex flex-col gap-5">
        {confirming === null ? (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-text">Force default audio track</legend>

              <p className="text-xs text-text-muted">
                Previews and playback prefer this language, when a file has a track in it. A file
                with no matching track keeps its own default.
              </p>

              <OptionMenu
                label="Force default audio track"
                groups={[
                  {
                    name: 'Language',
                    selectedId: selected,
                    onSelect: setSelected,
                    options: languageOptions,
                  },
                ]}
                trigger={
                  <span className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text">
                    {selectedLabel}
                    <IconSelector size={16} aria-hidden />
                  </span>
                }
                className="w-full max-w-sm"
                align="start"
                matchTriggerWidth
              />
            </fieldset>

            {error === null ? null : (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" isPill onClick={close} disabled={isSaving}>
                Cancel
              </Button>

              <Button
                variant="glossy"
                isPill
                isLoading={isSaving}
                onClick={() => {
                  void save();
                }}
              >
                Save
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-text-muted">
              This will start a preview generation task for {library.name}&rsquo;s existing media,
              so previews match {confirming.label}. Progress shows next to the library once started.
              Continue?
            </p>

            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                isPill
                onClick={() => {
                  finish(confirming.saved);
                }}
              >
                Not now
              </Button>

              <Button variant="glossy" isPill onClick={regenerate}>
                Regenerate previews
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

LibrarySettingsDialog.displayName = 'LibrarySettingsDialog';

export { LibrarySettingsDialog };
