import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import ButtonModule from '@FluxUI/Button'
import IconButtonModule from '@FluxUI/IconButton'
import TextFieldModule from '@FluxUI/TextField'
import revealModule from '@FluxUI/animations/reveal'
import ViewerProfileModule from '@FluxContracts/schemas/ViewerProfile'
import fetchProfilesModule from '@FluxWeb/profiles/fetchProfiles'
import type { ProfileColour } from '@FluxContracts/schemas/ViewerProfile'
import type { ProfilePickerProps } from './ProfilePicker.types'

const { Button } = ButtonModule
const { IconButton } = IconButtonModule
const { TextField } = TextFieldModule
const { revealVariants, revealTransition, staggerVariants } = revealModule
const { PROFILE_COLOURS, profileInitial } = ViewerProfileModule
const { createProfile, removeProfile } = fetchProfilesModule

/**
 * Who is watching.
 *
 * The one screen between signing in and the library, and deliberately the
 * whole screen: choosing who you are is a decision, not a setting, and a
 * household that shares a login shares nothing else — what one person left
 * half watched is noise on somebody else's home page.
 *
 * Portraits are a letter on a colour rather than a picture. Nobody uploads an
 * avatar for a profile they made in four seconds, and a grid of grey silhouettes
 * says less than a grid of colours people recognise from across the room.
 */
const ProfilePicker = ({
  profiles,
  onChoose,
  onChanged,
  isEditable = false,
}: ProfilePickerProps) => {
  const [isAdding, setIsAdding] = useState(false)
  const [name, setName] = useState('')
  const [colour, setColour] = useState<ProfileColour>(PROFILE_COLOURS[0])
  const [isSaving, setIsSaving] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      variants={staggerVariants}
      initial="hidden"
      animate="shown"
      className="flex min-h-svh flex-col items-center justify-center gap-12 px-6 py-16"
    >
      <motion.h1
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion, 'heavy')}
        className="text-[clamp(2rem,7vw,4rem)] font-semibold tracking-[-0.04em] text-text"
      >
        Who is watching?
      </motion.h1>

      <motion.ul
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion)}
        className="flex flex-wrap items-start justify-center gap-6 sm:gap-10"
      >
        {profiles.map((profile) => (
          <li key={profile.id} className="relative">
            <motion.button
              type="button"
              onClick={() => {
                onChoose(profile)
              }}
              {...(prefersReducedMotion === true
                ? {}
                : { whileHover: { y: -6 }, whileTap: { scale: 0.97 } })}
              transition={revealTransition(prefersReducedMotion)}
              className="flex w-24 flex-col items-center gap-3 sm:w-32"
            >
              <span
                style={{ backgroundColor: profile.colour }}
                className="flex aspect-square w-full items-center justify-center rounded-3xl text-4xl font-semibold text-black/80 shadow-lg sm:text-5xl"
              >
                {profileInitial(profile.name)}
              </span>

              <span className="w-full truncate text-center text-sm text-text-muted">
                {profile.name}
              </span>
            </motion.button>

            {!isEditable || profiles.length < 2 ? null : (
              <span className="absolute -right-2 -top-2">
                <IconButton
                  label={`Remove ${profile.name}`}
                  onClick={() => {
                    void removeProfile(profile.id).then(onChanged)
                  }}
                  className="bg-surface-raised"
                >
                  <IconTrash size={16} aria-hidden />
                </IconButton>
              </span>
            )}
          </li>
        ))}

        {!isEditable || profiles.length >= PROFILE_COLOURS.length ? null : (
          <li>
            <button
              type="button"
              onClick={() => {
                setIsAdding(true)
              }}
              className="flex w-24 flex-col items-center gap-3 sm:w-32"
            >
              <span className="flex aspect-square w-full items-center justify-center rounded-3xl border border-dashed border-white/20 text-text-muted">
                <IconPlus size={28} aria-hidden />
              </span>

              <span className="text-sm text-text-muted">Add</span>
            </button>
          </li>
        )}
      </motion.ul>

      {!isAdding ? null : (
        <motion.div
          variants={revealVariants(prefersReducedMotion)}
          transition={revealTransition(prefersReducedMotion)}
          className="flex w-full max-w-sm flex-col gap-4"
        >
          <TextField label="Name" value={name} onValueChange={setName} placeholder="Their name" />

          <fieldset className="flex flex-col gap-2">
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

          <div className="flex items-center gap-2">
            <Button
              variant="glossy"
              size="sm"
              isPill
              isLoading={isSaving}
              disabled={name.trim() === ''}
              onClick={() => {
                setIsSaving(true)

                void createProfile(name.trim(), colour).then((added) => {
                  setIsSaving(false)

                  if (added) {
                    setName('')
                    setIsAdding(false)
                    onChanged()
                  }
                })
              }}
            >
              Add
            </Button>

            <Button
              variant="ghost"
              size="sm"
              isPill
              onClick={() => {
                setIsAdding(false)
              }}
            >
              Cancel
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

ProfilePicker.displayName = 'ProfilePicker'

export default { ProfilePicker }
