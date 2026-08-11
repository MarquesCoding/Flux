import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { IconButton } from '@FluxUI/IconButton'
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal'
import { removeProfile } from '@FluxWeb/profiles/fetchProfiles'
import { ProfileFace } from '@FluxWeb/components/ProfileFace/ProfileFace'
import { ProfileEditor } from './components/ProfileEditor/ProfileEditor'
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile'
import type { ProfilePickerProps } from './ProfilePicker.types'

/**
 * How many people may share one account.
 *
 * Matches what the server will accept, so the offer to add somebody
 * disappears rather than failing when it is taken up.
 */
const PROFILE_LIMIT = 6
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
  // Null means nothing is being edited; a profile means that one is; and the
  // string means a new one is being made. Three states in one, because they
  // are three states of the same screen.
  const [editing, setEditing] = useState<ViewerProfile | 'new' | null>(null)
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
              <ProfileFace
                profile={profile}
                className="aspect-square w-full rounded-3xl text-4xl shadow-lg sm:text-5xl"
              />

              <span className="w-full truncate text-center text-sm text-text-muted">
                {profile.name}
              </span>
            </motion.button>

            {!isEditable ? null : (
              <span className="absolute -right-2 -top-2 flex gap-1">
                <IconButton
                  label={`Edit ${profile.name}`}
                  onClick={() => {
                    setEditing(profile)
                  }}
                  className="bg-surface-raised"
                >
                  <IconPencil size={16} aria-hidden />
                </IconButton>

                {profiles.length < 2 ? null : (
                  <IconButton
                    label={`Remove ${profile.name}`}
                    onClick={() => {
                      void removeProfile(profile.id).then(onChanged)
                    }}
                    className="bg-surface-raised"
                  >
                    <IconTrash size={16} aria-hidden />
                  </IconButton>
                )}
              </span>
            )}
          </li>
        ))}

        {!isEditable || profiles.length >= PROFILE_LIMIT ? null : (
          <li>
            <button
              type="button"
              onClick={() => {
                setEditing('new')
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

      {editing === null ? null : (
        <motion.div
          variants={revealVariants(prefersReducedMotion)}
          transition={revealTransition(prefersReducedMotion)}
          className="flex w-full justify-center"
        >
          <ProfileEditor
            profile={editing === 'new' ? null : editing}
            onSaved={() => {
              setEditing(null)
              onChanged()
            }}
            onCancel={() => {
              setEditing(null)
            }}
          />
        </motion.div>
      )}
    </motion.div>
  )
}

ProfilePicker.displayName = 'ProfilePicker'

export { ProfilePicker }
