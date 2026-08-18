const BITS_IN_BYTE = 8;

const BITS_IN_KBIT = 1000;

const ENOUGH_MEDIA_SECONDS = 4;

type DeliveredBitrateKbpsOptions = {
  declaredBandwidth: number | null | undefined;
  bytesFetched: number | null | undefined;
  mediaSecondsFetched: number | null | undefined;
};

/**
 * What the stream is actually costing, in kilobits a second.
 *
 * Taken from the manifest where the manifest says, and measured over a window where it does not.
 * Flux hands the player a media playlist rather than a master one — there is a single rendition, so
 * nothing to choose between and no `EXT-X-STREAM-INF` to carry a `BANDWIDTH` — which leaves the
 * engine declaring nought.
 *
 * Measured against **media fetched**, not time played, and that distinction is the whole of it. The
 * bytes an engine has downloaded correspond to the media it has downloaded, and Flux transcodes
 * ahead of the viewer, so a great deal more is fetched than has been watched. Divided by time
 * played the figure opens absurdly high — forty megabits for a stream encoded at seven hundred
 * kilobits — and sinks for the rest of the film as the denominator catches up, never settling
 * because it is an average over everything that has happened rather than a reading of what is
 * happening.
 *
 * Both arguments are therefore deltas since the last reading. Over a window the two advance
 * together and their ratio is the bitrate, whatever the engine did before it.
 *
 * @param options - What the manifest declared, and what arrived since the last reading.
 * @returns The rate in kbps, or null where neither source can answer yet.
 */
const deliveredBitrateKbps = ({
  declaredBandwidth,
  bytesFetched,
  mediaSecondsFetched,
}: DeliveredBitrateKbpsOptions): number | null => {
  if (
    typeof declaredBandwidth === 'number' &&
    Number.isFinite(declaredBandwidth) &&
    declaredBandwidth > 0
  ) {
    return Math.round(declaredBandwidth / BITS_IN_KBIT);
  }

  if (
    typeof bytesFetched !== 'number' ||
    typeof mediaSecondsFetched !== 'number' ||
    !Number.isFinite(bytesFetched) ||
    !Number.isFinite(mediaSecondsFetched) ||
    bytesFetched <= 0 ||
    mediaSecondsFetched < ENOUGH_MEDIA_SECONDS
  ) {
    return null;
  }

  return Math.round((bytesFetched * BITS_IN_BYTE) / mediaSecondsFetched / BITS_IN_KBIT);
};

export type { DeliveredBitrateKbpsOptions };

export { deliveredBitrateKbps, ENOUGH_MEDIA_SECONDS };
