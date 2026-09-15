import { z } from 'zod';

const SubtitleSpanSchema = z.object({
  text: z.string(),
  fontFamily: z.string().nullable(),
  fontHeight: z.number().nullable(),
  colour: z.string().nullable(),
  opacity: z.number().nullable(),
  isBold: z.boolean(),
  isItalic: z.boolean(),
  isUnderlined: z.boolean(),
  isStruckThrough: z.boolean(),
});

const SubtitleCueSchema = z.object({
  from: z.number(),
  to: z.number(),
  spans: z.array(SubtitleSpanSchema),
  alignment: z.number().int().min(1).max(9),
  position: z.object({ x: z.number(), y: z.number() }).nullable(),
  margins: z.object({ left: z.number(), right: z.number(), vertical: z.number() }),
  isSign: z.boolean(),
});

const SubtitleCuesSchema = z.object({ cues: z.array(SubtitleCueSchema) });

type SubtitleSpan = z.infer<typeof SubtitleSpanSchema>;

type SubtitleCue = z.infer<typeof SubtitleCueSchema>;

/**
 * Builds the address a track's styled lines are served from.
 *
 * @param mediaId - The item being played.
 * @param trackId - Which track.
 * @param fromSeconds - Where to begin the track, for a stream that starts part-way in.
 * @returns The address to ask.
 */
const subtitleCuesUrl = (mediaId: string, trackId: string, fromSeconds = 0): string =>
  `/api/media/${mediaId}/subtitles/${trackId}/cues?from=${Math.max(0, Math.floor(fromSeconds)).toString()}`;

/**
 * Reads a track as lines that kept where they go and what they were dressed in.
 *
 * Only a script carries any of that. Every other kind of subtitle answers with nothing here and is
 * read as WebVTT instead, which is also what happens to a script on a server too old to have been
 * asked this — so a client never has to know which it is talking to.
 *
 * @param url - The address the lines are served from.
 * @returns The lines, or null where this track has no styled form.
 */
const fetchSubtitleCues = async (url: string): Promise<SubtitleCue[] | null> => {
  try {
    const answer = await fetch(url);

    if (!answer.ok) {
      return null;
    }

    const read = SubtitleCuesSchema.safeParse(await answer.json());

    return read.success ? read.data.cues : null;
  } catch {
    return null;
  }
};

export type { SubtitleCue, SubtitleSpan };

export { SubtitleCuesSchema, fetchSubtitleCues, subtitleCuesUrl };
