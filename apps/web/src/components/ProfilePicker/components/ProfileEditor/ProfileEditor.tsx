import { useState } from 'react';
import { RiImageAddLine, RiRefreshLine } from '@remixicon/react';
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
  const [isSaving, setIsSaving] = useState(false);

  const trimmed = name.trim();

  const save = async () => {
    setIsSaving(true);

    const chosen: Avatar =
      photo === null ? avatar : { kind: 'photo', isVideo: photo.type.startsWith('video/') };

    const saved =
      profile === null
        ? await createProfile(trimmed, colour, chosen)
        : await saveProfile(profile.id, trimmed, colour, chosen);

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
            className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl"
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
              createdAt: profile?.createdAt ?? '',
              updatedAt: profile?.updatedAt ?? '',
            }}
            pending={photo}
            className="size-20 shrink-0 rounded-3xl text-3xl"
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
                option === colour ? 'scale-110 ring-2 ring-text' : 'hover:scale-105'
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
            className={`flex size-14 items-center justify-center rounded-2xl text-xl font-semibold text-black/80 transition-transform ${
              avatar.kind === 'initial' && photo === null
                ? 'scale-105 ring-2 ring-text'
                : 'hover:scale-105'
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
              className={`size-14 overflow-hidden rounded-2xl bg-white/5 transition-transform ${
                avatar.kind === 'drawn' && avatar.style === style && photo === null
                  ? 'scale-105 ring-2 ring-text'
                  : 'hover:scale-105'
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
            <RiRefreshLine size={16} aria-hidden />
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
                <RiImageAddLine size={16} aria-hidden />
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
