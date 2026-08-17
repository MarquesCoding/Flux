import { z } from 'zod';
import { StillWatchingSchema } from './StillWatching';

const PROFILE_COLOURS = ['#e8503a', '#e8a33a', '#3ac47d', '#3a8ee8', '#8b5ce8', '#e83a90'] as const;

const ProfileColourSchema = z.enum(PROFILE_COLOURS);

const NAME_MAX = 24;

const AVATAR_STYLES = [
  'adventurer',
  'lorelei',
  'notionists',
  'bottts',
  'funEmoji',
  'thumbs',
] as const;

const AvatarStyleSchema = z.enum(AVATAR_STYLES);

const AvatarSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('initial') }),
  z.object({ kind: z.literal('drawn'), style: AvatarStyleSchema, seed: z.string().min(1).max(64) }),
  z.object({
    kind: z.literal('photo'),
    isVideo: z.boolean().default(false),
  }),
]);

const ViewerProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(NAME_MAX),
  colour: ProfileColourSchema,
  avatar: AvatarSchema,
  askStillWatchingAfter: StillWatchingSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

const ViewerProfileRequestSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX),
  colour: ProfileColourSchema,
  avatar: AvatarSchema.optional(),
  askStillWatchingAfter: StillWatchingSchema.optional(),
});

const ViewerProfileListSchema = z.object({ profiles: z.array(ViewerProfileSchema) });

/**
 * Picks the letter a profile is drawn with while it has no picture of its own — the first character
 * of the name, upper-cased. A name that is empty or only spaces falls back to a question mark
 * rather than to a blank circle nobody can aim at.
 *
 * @param name - The profile's name as somebody typed it.
 * @returns A single character to draw in the circle.
 */
const profileInitial = (name: string): string => (name.trim()[0] ?? '?').toUpperCase();

/**
 * Builds the address a profile's picture is served from, carrying the profile's own last-updated
 * time as part of the query so that changing the picture changes the address. Without that a
 * browser shows the old face until its cache expires, which is long after somebody has changed it
 * and gone looking for the new one.
 *
 * @param profile - The profile being drawn, with the time it was last changed.
 * @returns The address to load the picture from.
 */
const profileAvatarUrl = (profile: { id: string; updatedAt: string }): string =>
  `/api/profiles/${profile.id}/avatar?v=${encodeURIComponent(profile.updatedAt)}`;

type Avatar = z.infer<typeof AvatarSchema>;
type AvatarStyle = z.infer<typeof AvatarStyleSchema>;
type ViewerProfile = z.infer<typeof ViewerProfileSchema>;
type ViewerProfileRequest = z.infer<typeof ViewerProfileRequestSchema>;
type ProfileColour = z.infer<typeof ProfileColourSchema>;

export type { Avatar, AvatarStyle, ProfileColour, ViewerProfile, ViewerProfileRequest };

export {
  ViewerProfileSchema,
  ViewerProfileRequestSchema,
  ViewerProfileListSchema,
  ProfileColourSchema,
  PROFILE_COLOURS,
  AvatarSchema,
  AvatarStyleSchema,
  AVATAR_STYLES,
  NAME_MAX,
  profileInitial,
  profileAvatarUrl,
};
