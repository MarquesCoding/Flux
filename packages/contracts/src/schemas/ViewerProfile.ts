import { z } from 'zod';

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
  createdAt: z.string(),
  updatedAt: z.string(),
});

const ViewerProfileRequestSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX),
  colour: ProfileColourSchema,
  avatar: AvatarSchema.optional(),
});

const ViewerProfileListSchema = z.object({ profiles: z.array(ViewerProfileSchema) });

/**
 * The letter a profile is drawn with when it has no picture.
 */
const profileInitial = (name: string): string => (name.trim()[0] ?? '?').toUpperCase();

/**
 * Where a profile's picture is served from.
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
