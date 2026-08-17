import { listAvailableQualitySteps } from '@FluxCore/functions/listAvailableQualitySteps';
import { negotiatePlayback } from '@FluxCore/functions/negotiatePlayback';
import { resolveQualityStep } from '@FluxCore/functions/resolveQualityStep';
import { describeRungCost } from '@FluxWeb/playback/describeRungCost';
import type { QualityPreference } from '@FluxWeb/playback/qualityPreference';
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
 * The original is described too, from the file's own bitrate, so the rungs have something to be
 * read against. Without it a viewer sees what each rung costs and nothing about what they are
 * choosing between, which is the comparison they opened the menu to make.
 *
 * @param options - What is playing, and what the viewer is playing it on.
 * @returns The cost of the original and of each rung on offer.
 */
const qualityStepCostsFor = ({
  media,
  profile,
}: QualityStepCostsForOptions): Partial<Record<QualityPreference, string>> => {
  try {
    const costs: Partial<Record<QualityPreference, string>> = {
      original: describeRungCost({
        maxBitrateKbps: media.bitrateKbps,
        durationSeconds: media.durationSeconds,
        isCeiling: false,
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
