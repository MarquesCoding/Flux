import { z } from 'zod';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

const WhatIsPlayingSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('watching'),
    title: z.string().min(1).max(200),
    series: z.string().min(1).max(200).nullable(),
    season: z.number().int().min(0).max(1000).nullable(),
    episode: z.number().int().min(0).max(10_000).nullable(),
    startedAt: z.number().int().nonnegative(),
    endsAt: z.number().int().nonnegative().nullable(),
    tmdbId: z
      .string()
      .regex(/^\d{1,12}$/)
      .nullable(),
    isSeries: z.boolean(),
    isPaused: z.boolean().catch(false),
    artwork: z.string().url().nullable().catch(null),
    party: z
      .object({ id: z.string().min(1).max(100), size: z.number().int().min(1).max(100) })
      .nullable()
      .catch(null),
  }),
  z.object({ kind: z.literal('browsing') }),
]);

/**
 * Reads what a page says is playing, or nothing where it said something else.
 *
 * It arrives from a page the server drew, over a bridge anything running in that page could reach,
 * and it ends up in somebody's public Discord status — so it is read rather than trusted. A title
 * far longer than a title, or a number where a name should be, stops here rather than being
 * published under their name.
 *
 * The artwork is read on its own terms rather than with the rest: a picture that cannot be used is a
 * reason to draw the logo instead, not a reason to say nothing about what somebody is watching.
 *
 * @param said - Whatever came across the bridge.
 * @returns What is playing, or nothing.
 */
const whatIsPlaying = (said: JsonValue) => WhatIsPlayingSchema.nullable().catch(null).parse(said);

export { whatIsPlaying };
