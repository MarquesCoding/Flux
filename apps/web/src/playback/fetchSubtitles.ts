import { z } from 'zod';

const SubtitleTrackSchema = z.object({
  id: z.string(),
  language: z.string().nullable(),
  label: z.string(),
  format: z.string(),
  isForced: z.boolean(),
  isHearingImpaired: z.boolean(),
});

const SubtitleListSchema = z.object({ tracks: z.array(SubtitleTrackSchema) });

type SubtitleTrack = z.infer<typeof SubtitleTrackSchema>;

const SUBTITLES_OFF = 'off';

/**
 * Reads the subtitle tracks available for an item, from inside the container and from the files
 * beside it, presented as one list.
 *
 * @param mediaId - The item being played.
 * @returns The tracks to offer, or none where the request failed.
 */
const fetchSubtitleTracks = async (mediaId: string): Promise<SubtitleTrack[]> => {
  try {
    const response = await fetch(`/api/media/${mediaId}/subtitles`, {
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      return [];
    }

    return SubtitleListSchema.parse(await response.json()).tracks;
  } catch {
    return [];
  }
};

/**
 * Builds the address a subtitle track is served from, converted to the one format a browser takes.
 *
 * @param mediaId - The item being played.
 * @param trackId - Which track.
 * @param fromSeconds - Where to begin the track, for a preview that starts part-way in.
 * @returns The address to attach to the video element.
 */
const subtitleTrackUrl = (mediaId: string, trackId: string, fromSeconds = 0): string =>
  `/api/media/${mediaId}/subtitles/${trackId}?from=${Math.max(0, Math.floor(fromSeconds)).toString()}`;

/**
 * Picks the track to show before anybody has chosen — a forced track where one exists, since forced
 * subtitles carry the parts of a film nobody is meant to miss, and otherwise nothing.
 *
 * @param tracks - The tracks available.
 * @returns The track to start with, or the identifier meaning none.
 */
const defaultTrackId = (tracks: SubtitleTrack[]): string =>
  tracks.find((track) => track.isForced)?.id ?? SUBTITLES_OFF;

/**
 * Finds the track that continues what a viewer was already reading, when playback moves to the next
 * episode — subtitles chosen once should not have to be chosen again per episode.
 *
 * @param tracks - The tracks available on the new item.
 * @param language - The language they were reading.
 * @returns The track to select, or null where this item has none in that language.
 */
const trackForLanguage = (
  tracks: SubtitleTrack[],
  language: string | null,
): SubtitleTrack | null => {
  if (language === null || language === '') {
    return null;
  }

  const spoken = language.split('-')[0]?.toLowerCase() ?? '';

  return tracks.find((track) => (track.language ?? '').toLowerCase().startsWith(spoken)) ?? null;
};

/**
 * Picks the track a hover preview should carry, which is a forced one or none at all — a preview
 * runs for a few seconds and full subtitles on it are noise.
 *
 * @param tracks - The tracks available.
 * @param language - The language being spoken, so a forced track in it is preferred to one in another.
 * @returns The track to burn into the preview, or null for none.
 */
const previewTrack = (tracks: SubtitleTrack[], language: string): SubtitleTrack | null => {
  const spoken = language.split('-')[0]?.toLowerCase() ?? '';

  return (
    tracks.find((track) => (track.language ?? '').toLowerCase().startsWith(spoken)) ??
    tracks[0] ??
    null
  );
};

export type { SubtitleTrack };

export {
  fetchSubtitleTracks,
  subtitleTrackUrl,
  defaultTrackId,
  previewTrack,
  trackForLanguage,
  SUBTITLES_OFF,
};
