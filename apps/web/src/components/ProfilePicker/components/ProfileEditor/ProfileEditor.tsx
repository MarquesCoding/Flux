import { useState } from 'react'
import { IconPhotoUp, IconRefresh } from '@tabler/icons-react'
import { Button } from '@FluxUI/Button'
import { TextField } from '@FluxUI/TextField'
import { FilePicker } from '@FluxUI/FilePicker'
import {
  PROFILE_COLOURS,
  AVATAR_STYLES,
  profileInitial,
} from '@FluxContracts/schemas/ViewerProfile'
import { createProfile, saveProfile, uploadProfilePhoto } from '@FluxWeb/profiles/fetchProfiles'
import { ProfileFace } from '@FluxWeb/components/ProfileFace/ProfileFace'
import type { Avatar, AvatarStyle, ProfileColour } from '@FluxContracts/schemas/ViewerProfile'
import type { ProfileEditorProps } from './ProfileEditor.types'

/**
 * What a picture may be.
 *
 * Raster and video, matching what the server will keep. No SVG: it is a
 * document that can carry script, and a picture of somebody's face has no
 * reason to be one.
 */
const PHOTO_TYPES = 'image/jpeg,image/png,image/webp,image/avif,image/gif,video/webm,video/mp4'

/**
 * Where a drawn face is previewed from.
 *
 * Through Flux like everything else: a self-hosted server has no business
 * telling a third party who has profiles on it, so the faces are drawn here
 * rather than fetched from whoever generates them.
 */
const previewUrl = (style: AvatarStyle, seed: string): string =>
  `/api/profiles/avatars/${style}?seed=${encodeURIComponent(seed)}`

/**
 * Changing what somebody is called and what they look like.
 *
 * Three ways to have a face, in the order people actually want them: the
 * letter they already have, one of a handful of drawn ones, or a photograph
 * of their own. Every drawn style is shown at once rather than behind a menu,
 * because choosing a picture is a thing done by looking.
 */
const ProfileEditor = ({ profile, onSaved, onCancel }: ProfileEditorProps) => {
  const [name, setName] = useState(profile?.name ?? '')
  const [colour, setColour] = useState<ProfileColour>(profile?.colour ?? PROFILE_COLOURS[0])
  const [avatar, setAvatar] = useState<Avatar>(profile?.avatar ?? { kind: 'initial' })
  const [seed, setSeed] = useState(
    profile?.avatar.kind === 'drawn' ? profile.avatar.seed : (profile?.id ?? 'flux'),
  )
  const [photo, setPhoto] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const trimmed = name.trim()

  const save = async () => {
    setIsSaving(true)

    const chosen: Avatar =
      photo === null ? avatar : { kind: 'photo', isVideo: photo.type.startsWith('video/') }

    const saved =
      profile === null
        ? await createProfile(trimmed, colour, chosen)
        : await saveProfile(profile.id, trimmed, colour, chosen)

    // The photograph goes second because a new profile has no identifier to
    // hang one on until it exists.
    if (saved && photo !== null && profile !== null) {
      await uploadProfilePhoto(profile.id, photo)
    }

    setIsSaving(false)

    if (saved) {
      onSaved()
    }
  }

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
            <button
              key={option}
              type="button"
              aria-label={`Use ${option}`}
              aria-pressed={option === colour}
              onClick={() => {
                setColour(option)
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
          <button
            type="button"
            aria-pressed={avatar.kind === 'initial' && photo === null}
            onClick={() => {
              setPhoto(null)
              setAvatar({ kind: 'initial' })
            }}
            style={{ backgroundColor: colour }}
            className={`flex size-14 items-center justify-center rounded-2xl text-xl font-semibold text-black/80 transition-transform ${
              avatar.kind === 'initial' && photo === null
                ? 'scale-105 ring-2 ring-text'
                : 'hover:scale-105'
            }`}
          >
            {profileInitial(trimmed === '' ? '?' : trimmed)}
          </button>

          {AVATAR_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              aria-label={`Use the ${style} face`}
              aria-pressed={avatar.kind === 'drawn' && avatar.style === style && photo === null}
              onClick={() => {
                setPhoto(null)
                setAvatar({ kind: 'drawn', style, seed })
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
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            isPill
            onClick={() => {
              // A new seed is a new face in every style at once, which is what
              // somebody means when they press this: not "a different style"
              // but "not that one".
              const next = Math.random().toString(36).slice(2, 10)

              setSeed(next)
              setPhoto(null)

              if (avatar.kind === 'drawn') {
                setAvatar({ kind: 'drawn', style: avatar.style, seed: next })
              }
            }}
          >
            <IconRefresh size={16} aria-hidden />
            Different faces
          </Button>

          {profile === null ? null : (
            <FilePicker
              label="Upload a photograph"
              accept={PHOTO_TYPES}
              onPick={(file) => {
                setPhoto(file)
              }}
            >
              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-text-muted transition-colors hover:bg-white/10 hover:text-text">
                <IconPhotoUp size={16} aria-hidden />
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
            void save()
          }}
        >
          {profile === null ? 'Add' : 'Save'}
        </Button>

        <Button variant="ghost" size="sm" isPill onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

ProfileEditor.displayName = 'ProfileEditor'

export { ProfileEditor }
