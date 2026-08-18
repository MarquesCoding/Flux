import { listAvailableQualitySteps } from '@FluxCore/functions/listAvailableQualitySteps';
import { negotiatePlayback } from '@FluxCore/functions/negotiatePlayback';
import { resolveQualityStep } from '@FluxCore/functions/resolveQualityStep';
import { describeRungCost } from '@FluxClient/playback/describeRungCost';
import type { QualityPreference } from '@FluxClient/playback/qualityPreference';
import type { DeviceProfile } from '@FluxContracts/schemas/DeviceProfile';
import type { MediaItem } from '@FluxContracts/schemas/MediaItem';

type QualityStepCostsForOptions = {
  media: MediaItem;
  profile: DeviceProfile;
};

/**
 * What each rung on offer would actually cost this viewer, keyed by rung.
 *
 * Asked of the negotiator rather than worked out here, so the figure shown is the one the server
 * will encode to rather than a second opinion free to drift from it. A rung's own ceiling is a
 * generic number for the resolution; what comes out is derived from the source, and for a file
 * somebody has already compressed well the two are far apart.
 *
 * Answers with nothing rather than throwing. This is a label on a menu, and a label is never worth
 * a player that will not render — a profile that arrives half formed, from a client that reported
 * oddly or a browser that answered no to every codec, leaves the rungs described by their ceilings
 * exactly as before.
 *
 * The original is described too, so the rungs have something to be read against. Without it a
 * viewer sees what each rung costs and nothing about what they are choosing between, which is the
 * comparison they opened the menu to make.
 *
 * It is negotiated rather than read off the file, because "original" does not always mean the file.
 * A device that cannot decode HEVC gets the original re-encoded to H.264, and H.264 needs about
 * two thirds more bits for the same picture — so a 8.9 Mbps source arrives as roughly 14.8. Quoting
 * the file's own figure there would understate what the viewer is about to spend by half again, and
 * understate it precisely for the people on the weaker devices. Where it genuinely is the file,
 * the figure is the file's and is stated plainly; where it is a re-encode, it is a ceiling and
 * reads as one.
 *
 * @param options - What is playing, and what the viewer is playing it on.
 * @returns The cost of the original and of each rung on offer.
 */
const qualityStepCostsFor = ({
  media,
  profile,
}: QualityStepCostsForOptions): Partial<Record<QualityPreference, string>> => {
  try {
    const asIs = negotiatePlayback(media, profile, null).video;

    const costs: Partial<Record<QualityPreference, string>> = {
      original: describeRungCost({
        maxBitrateKbps: asIs.kind === 'transcode' ? asIs.maxBitrateKbps : media.bitrateKbps,
        durationSeconds: media.durationSeconds,
        isCeiling: asIs.kind === 'transcode',
      }),
    };

    for (const id of listAvailableQualitySteps(media)) {
      const plan = negotiatePlayback(media, profile, resolveQualityStep(media, id));

      if (plan.video.kind === 'transcode') {
        costs[id] = describeRungCost({
          maxBitrateKbps: plan.video.maxBitrateKbps,
          durationSeconds: media.durationSeconds,
        });
      }
    }

    return costs;
  } catch {
    return {};
  }
};

export type { QualityStepCostsForOptions };

export { qualityStepCostsFor };
