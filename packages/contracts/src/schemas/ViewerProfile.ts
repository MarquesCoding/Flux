import { z } from 'zod';

/**
 * The colours a profile may be drawn in.
 *
 * A fixed set rather than a free colour: everything on screen is tuned against
 * these, and a household picking its own hex values produces one profile
 * nobody can read against the background.
 */
const PROFILE_COLOURS = ['#e8503a', '#e8a33a', '#3ac47d', '#3a8ee8', '#8b5ce8', '#e83a90'] as const;

const ProfileColourSchema = z.enum(PROFILE_COLOURS);

/**
 * How long a profile name may be.
 *
 * Enough for a name, not enough for a sentence: these are drawn under a
 * portrait on a picker, where anything longer stops being a label.
 */
const NAME_MAX = 24;

/**
 * The drawn avatar styles a profile may wear.
 *
 * Named here so the browser can offer them without asking the server what
 * exists. Which library draws them is the server's business.
 */
const AVATAR_STYLES = [
  'adventurer',
  'lorelei',
  'notionists',
  'bottts',
  'funEmoji',
  'thumbs',
] as const;

const AvatarStyleSchema = z.enum(AVATAR_STYLES);

/**
 * What a profile is drawn with.
 *
 * A letter on a colour by default, because nobody uploads a photograph for a
 * profile they made in four seconds.
 */
const AvatarSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('initial') }),
  z.object({ kind: z.literal('drawn'), style: AvatarStyleSchema, seed: z.string().min(1).max(64) }),
  z.object({
    kind: z.literal('photo'),
    /**
     * Whether the picture moves and needs a video element to play it.
     *
     * A GIF is still a picture as far as a browser is concerned; a WebM is
     * not, and drawing one in an image tag shows nothing at all.
     */
    isVideo: z.boolean().default(false),
  }),
]);

const ViewerProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(NAME_MAX),
  colour: ProfileColourSchema,
  avatar: AvatarSchema,
  createdAt: z.string(),
  /**
   * When this was last changed.
   *
   * Carried so a picture can be addressed by version. Without it the address
   * of somebody's face never changes, and a browser that has already fetched
   * one goes on showing it however many times they replace it.
   */
  updatedAt: z.string(),
});

const ViewerProfileRequestSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX),
  colour: ProfileColourSchema,
  /**
   * Left out to keep whatever the profile already wears.
   */
  avatar: AvatarSchema.optional(),
});

const ViewerProfileListSchema = z.object({ profiles: z.array(ViewerProfileSchema) });

/**
 * The letter a profile is drawn with when it has no picture.
 *
 * The first character rather than initials: a household has "Mum" and "Sam",
 * not "Margaret Anne Fitzgerald", and one large letter reads at a glance where
 * two small ones do not.
 */
const profileInitial = (name: string): string => (name.trim()[0] ?? '?').toUpperCase();

/**
 * Where a profile's picture is served from.
 *
 * Always through Flux, whether it was drawn or uploaded: the browser should
 * not need to know which, and a self-hosted server should not send anybody
 * elsewhere to find out what its users look like.
 *
 * Addressed by version, so replacing a picture replaces its address. A face
 * kept at one address is a face a browser will go on showing from its cache
 * long after somebody has changed it.
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
