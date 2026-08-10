import { z } from 'zod'

/**
 * The colours a profile may be drawn in.
 *
 * A fixed set rather than a free colour: everything on screen is tuned against
 * these, and a household picking its own hex values produces one profile
 * nobody can read against the background.
 */
const PROFILE_COLOURS = ['#e8503a', '#e8a33a', '#3ac47d', '#3a8ee8', '#8b5ce8', '#e83a90'] as const

const ProfileColourSchema = z.enum(PROFILE_COLOURS)

/**
 * How long a profile name may be.
 *
 * Enough for a name, not enough for a sentence: these are drawn under a
 * portrait on a picker, where anything longer stops being a label.
 */
const NAME_MAX = 24

const ViewerProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(NAME_MAX),
  colour: ProfileColourSchema,
  createdAt: z.string(),
})

const ViewerProfileRequestSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX),
  colour: ProfileColourSchema,
})

const ViewerProfileListSchema = z.object({ profiles: z.array(ViewerProfileSchema) })

/**
 * The letter a profile is drawn with when it has no picture.
 *
 * The first character rather than initials: a household has "Mum" and "Sam",
 * not "Margaret Anne Fitzgerald", and one large letter reads at a glance where
 * two small ones do not.
 */
const profileInitial = (name: string): string => (name.trim()[0] ?? '?').toUpperCase()

type ViewerProfile = z.infer<typeof ViewerProfileSchema>
type ViewerProfileRequest = z.infer<typeof ViewerProfileRequestSchema>
type ProfileColour = z.infer<typeof ProfileColourSchema>

export type { ProfileColour, ViewerProfile, ViewerProfileRequest }

export default {
  ViewerProfileSchema,
  ViewerProfileRequestSchema,
  ViewerProfileListSchema,
  ProfileColourSchema,
  PROFILE_COLOURS,
  NAME_MAX,
  profileInitial,
}
