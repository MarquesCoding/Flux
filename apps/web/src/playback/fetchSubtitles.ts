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
 * Reads the subtitle tracks sitting beside an item.
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
 * Where a track is served from.
 */
const subtitleTrackUrl = (mediaId: string, trackId: string, fromSeconds = 0): string =>
  `/api/media/${mediaId}/subtitles/${trackId}?from=${Math.max(0, Math.floor(fromSeconds)).toString()}`;

/**
 * Picks the track to show before anyone has chosen one.
 */
const defaultTrackId = (tracks: SubtitleTrack[]): string =>
  tracks.find((track) => track.isForced)?.id ?? SUBTITLES_OFF;

/**
 * The track that continues what a viewer was already reading.
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
 * The track a preview should carry.
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
