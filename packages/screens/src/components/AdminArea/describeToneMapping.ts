import type { AdminOverview } from '@ValenceClient/admin/fetchAdmin';

type ToneMapper = {
  label: string;
  detail: string | null;
};

const SOFTWARE = {
  libplacebo: 'libplacebo',
  zscale: 'zscale',
  unavailable: '',
} as const;

/**
 * Says how this machine turns an HDR film into something an SDR screen can show, which is two
 * questions rather than one: what the graphics card proved it can convert on its own, and what is
 * left to do the rest in software.
 *
 * Worth showing because the answer differs between the machines Valence is developed on and the
 * ones it runs on — the shipped Linux build has libplacebo and the macOS one does not — so a
 * conversion that looks right in development can be done by a different filter in production.
 *
 * @param toneMapping - The software tone mapper this build has, if it has one.
 * @param hardwareToneMaps - The filters the graphics card proved it can tone map with.
 * @returns What to show against the row, and what is worth warning about underneath it — nothing,
 *   where the card is doing the work and there is a software mapper behind it.
 */
const describeToneMapping = (
  toneMapping: AdminOverview['transcoder']['toneMapping'],
  hardwareToneMaps: string[],
): ToneMapper => {
  const software = SOFTWARE[toneMapping];

  if (hardwareToneMaps.length > 0) {
    return {
      label: `${hardwareToneMaps.join(', ')} on the device`,
      detail:
        software === ''
          ? 'Anything the card cannot take is passed through untouched, because this build has no software tone mapper behind it.'
          : null,
    };
  }

  if (software === '') {
    return {
      label: 'None',
      detail:
        'This build has neither libplacebo nor zscale and the card proved nothing, so an HDR film is passed through as it is and looks washed out on a screen that cannot show it.',
    };
  }

  return {
    label: `${software}, in software`,
    detail: `The card proved no tone mapper of its own, so every HDR film converted for an SDR screen costs the processor ${software} on top of the encode.`,
  };
};

export { describeToneMapping };
