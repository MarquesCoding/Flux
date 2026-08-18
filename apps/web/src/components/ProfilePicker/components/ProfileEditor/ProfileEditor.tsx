import { Icon } from '@FluxUI/Icon';
import { ImageAdd01Icon, RefreshIcon } from '@hugeicons/core-free-icons';
import { useState } from 'react';
import { Button } from '@FluxUI/Button';
import { TextField } from '@FluxUI/TextField';
import { FilePicker } from '@FluxUI/FilePicker';
import {
  PROFILE_COLOURS,
  AVATAR_STYLES,
  profileInitial,
} from '@FluxContracts/schemas/ViewerProfile';
import { createProfile, saveProfile, uploadProfilePhoto } from '@FluxWeb/profiles/fetchProfiles';
import { ProfileFace } from '@FluxWeb/components/ProfileFace/ProfileFace';
import type { Avatar, AvatarStyle, ProfileColour } from '@FluxContracts/schemas/ViewerProfile';
import type { ProfileEditorProps } from './ProfileEditor.types';
import { STILL_WATCHING_DEFAULT, STILL_WATCHING_OFF } from '@FluxContracts/schemas/StillWatching';

const PHOTO_TYPES = 'image/jpeg,image/png,image/webp,image/avif,image/gif,video/webm,video/mp4';

/**
 * Builds the address a drawn face is previewed from, so the editor can show what a style and seed
 * produce before anybody commits to it.
 *
 * @param style - The drawing style.
 * @param seed - What the drawing is derived from.
 * @returns Where to fetch the preview.
 */
const previewUrl = (style: AvatarStyle, seed: string): string =>
  `/api/profiles/avatars/${style}?seed=${encodeURIComponent(seed)}`;

const ASK_AFTER_CHOICES = [STILL_WATCHING_OFF, 2, 3, 4, 6, 8] as const;

/**
 * Creates or changes a profile: what somebody is called, and whether their face is a drawing derived
 * from a seed, a colour, or a photograph they uploaded. The same form serves both, since editing an
 * existing profile and making a new one differ only in what the fields start out holding.
 *
 * @param profile - The profile being changed, or null to make a new one.
 * @param onSaved - Called once the profile has been written.
 * @param onCancel - Called if they back out without saving.
 */
const ProfileEditor = ({ profile, onSaved, onCancel }: ProfileEditorProps) => {
  const [name, setName] = useState(profile?.name ?? '');
  const [colour, setColour] = useState<ProfileColour>(profile?.colour ?? PROFILE_COLOURS[0]);
  const [avatar, setAvatar] = useState<Avatar>(profile?.avatar ?? { kind: 'initial' });
  const [seed, setSeed] = useState(
    profile?.avatar.kind === 'drawn' ? profile.avatar.seed : (profile?.id ?? 'flux'),
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [askAfter, setAskAfter] = useState(
    profile?.askStillWatchingAfter ?? STILL_WATCHING_DEFAULT,
  );
  const [isSaving, setIsSaving] = useState(false);

  const trimmed = name.trim();

  const save = async () => {
    setIsSaving(true);

    const chosen: Avatar =
      photo === null ? avatar : { kind: 'photo', isVideo: photo.type.startsWith('video/') };

    const saved =
      profile === null
        ? await createProfile(trimmed, colour, chosen)
        : await saveProfile(profile.id, trimmed, colour, chosen, askAfter);

    if (saved && photo !== null && profile !== null) {
      await uploadProfilePhoto(profile.id, photo);
    }

    setIsSaving(false);

    if (saved) {
      onSaved();
    }
  };

  return (
    <div className="flex w-full max-w-lg flex-col gap-6">
      <div className="flex items-center gap-5">
        {avatar.kind === 'drawn' && photo === null ? (
          <span
            style={{ backgroundColor: colour }}
            className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg"
          >
            <img
              src={previewUrl(avatar.style, seed)}
              alt=""
              className="h-full w-full object-cover"
            />
          </span>
        ) : (
          <ProfileFace
            profile={{
              id: profile?.id ?? '',
              name: trimmed === '' ? '?' : trimmed,
              colour,
              avatar,
              askStillWatchingAfter: askAfter,
              createdAt: profile?.createdAt ?? '',
              updatedAt: profile?.updatedAt ?? '',
            }}
            pending={photo}
            className="size-20 shrink-0 rounded-lg text-3xl"
          />
        )}

        <TextField
          label="Name"
          value={name}
          onValueChange={setName}
          placeholder="Their name"
          isPill
          size="lg"
          className="flex-1"
        />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-xs uppercase tracking-[0.16em] text-text-muted">Colour</legend>

        <div className="flex flex-wrap gap-3 pt-2">
          {PROFILE_COLOURS.map((option) => (
            <Button
              key={option}
              variant="bare"
              size="none"
              aria-label={`Use ${option}`}
              isActive={option === colour}
              onClick={() => {
                setColour(option);
              }}
              style={{ backgroundColor: option }}
              className={`size-9 rounded-full transition-transform ${
                option === colour ? 'scale-110 ring-2 ring-text' : 'hover-hover:hover:scale-105'
              }`}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="flex w-full items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-text-muted">
          Picture
        </legend>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            variant="bare"
            size="none"
            isActive={avatar.kind === 'initial' && photo === null}
            onClick={() => {
              setPhoto(null);
              setAvatar({ kind: 'initial' });
            }}
            style={{ backgroundColor: colour }}
            className={`flex size-14 items-center justify-center rounded-lg text-xl font-semibold text-black/80 transition-transform ${
              avatar.kind === 'initial' && photo === null
                ? 'scale-105 ring-2 ring-text'
                : 'hover-hover:hover:scale-105'
            }`}
          >
            {profileInitial(trimmed === '' ? '?' : trimmed)}
          </Button>

          {AVATAR_STYLES.map((style) => (
            <Button
              key={style}
              variant="bare"
              size="none"
              aria-label={`Use the ${style} face`}
              isActive={avatar.kind === 'drawn' && avatar.style === style && photo === null}
              onClick={() => {
                setPhoto(null);
                setAvatar({ kind: 'drawn', style, seed });
              }}
              className={`size-14 overflow-hidden rounded-lg bg-white/5 transition-transform ${
                avatar.kind === 'drawn' && avatar.style === style && photo === null
                  ? 'scale-105 ring-2 ring-text'
                  : 'hover-hover:hover:scale-105'
              }`}
            >
              <img
                src={previewUrl(style, seed)}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            isPill
            onClick={() => {
              const next = Math.random().toString(36).slice(2, 10);

              setSeed(next);
              setPhoto(null);

              if (avatar.kind === 'drawn') {
                setAvatar({ kind: 'drawn', style: avatar.style, seed: next });
              }
            }}
          >
            <Icon of={RefreshIcon} size={16} />
            Different faces
          </Button>

          {profile === null ? null : (
            <FilePicker
              label="Upload a photograph"
              accept={PHOTO_TYPES}
              onPick={(file) => {
                setPhoto(file);
              }}
            >
              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-text-muted transition-colors hover:bg-white/10 hover:text-text">
                <Icon of={ImageAdd01Icon} size={16} />
                {photo === null ? 'Upload a photo' : photo.name}
              </span>
            </FilePicker>
          )}
        </div>

        {profile !== null ? null : (
          <p className="text-xs text-text-muted">
            A photograph can be added once this profile exists.
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
          Are you still watching?
        </legend>

        <p className="text-xs leading-relaxed text-text-muted">
          After this many episodes carry on by themselves, Flux asks before playing another — so a
          night asleep in front of the telly does not mark half a series as watched.
        </p>

        <ul className="flex flex-wrap gap-2">
          {ASK_AFTER_CHOICES.map((choice) => (
            <li key={choice}>
              <Button
                size="sm"
                isPill
                variant={askAfter === choice ? 'glossy' : 'ghost'}
                isActive={askAfter === choice}
                onClick={() => {
                  setAskAfter(choice);
                }}
              >
                {choice === STILL_WATCHING_OFF ? 'Never ask' : choice.toString()}
              </Button>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="flex items-center gap-2">
        <Button
          variant="glossy"
          size="sm"
          isPill
          isLoading={isSaving}
          disabled={trimmed === ''}
          onClick={() => {
            void save();
          }}
        >
          {profile === null ? 'Add' : 'Save'}
        </Button>

        <Button variant="ghost" size="sm" isPill onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

ProfileEditor.displayName = 'ProfileEditor';

export { ProfileEditor };
