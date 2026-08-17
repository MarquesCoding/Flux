import { z } from 'zod';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';
import type { Logger } from './Logger';

const TranscoderLineSchema = z.object({
  atMs: z.number().int().nonnegative(),
  level: z.enum(['info', 'warn', 'error']),
  source: z.string().min(1),
  message: z.string(),
});

const ReportSchema = z.object({ logs: z.array(TranscoderLineSchema).default([]) });

type TranscoderIntake = {
  take: (report: JsonValue) => void;
};

/**
 * Copies what the media service has recorded into the server's own log, so that an operator reading
 * one page sees both processes.
 *
 * Somebody debugging a failed transcode does not care which of the two spoke, and the only way to
 * see a request and the media service's answer to it next to each other is to have them in one
 * place, time-ordered, with the source marked.
 *
 * The media service keeps a rolling window and sends the whole of it on every reading, so the same
 * lines arrive again and again; only what is newer than the last line taken is kept. Its clock is
 * its own, which is why a merged view will occasionally interleave two lines written a millisecond
 * apart in the wrong order — worth knowing, and not worth a clock protocol to fix.
 *
 * @param log - Where the lines are written.
 * @returns The intake.
 */
const createTranscoderIntake = (log: Logger): TranscoderIntake => {
  let takenUpToMs = 0;

  return {
    take: (report) => {
      const read = ReportSchema.safeParse(report);

      if (!read.success) {
        return;
      }

      const fresh = read.data.logs
        .filter((line) => line.atMs > takenUpToMs)
        .sort((one, other) => one.atMs - other.atMs);

      for (const line of fresh) {
        log[line.level]('transcoder', `${line.source}: ${line.message}`);
      }

      takenUpToMs = fresh.reduce((newest, line) => Math.max(newest, line.atMs), takenUpToMs);
    },
  };
};

export type { TranscoderIntake };

export { createTranscoderIntake };
