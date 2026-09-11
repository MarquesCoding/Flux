import type { HardwareChain } from '@ValenceClient/admin/fetchAdmin';

type Refusal = {
  id: string;
  what: string;
  reason: string;
};

type Chains = {
  label: string;
  tone: 'quiet' | 'warning';
  refusals: Refusal[];
};

const WORK = {
  preview: 'scrub previews',
  sheet: 'thumbnail sheets',
  transcode: 'transcodes',
} as const;

/**
 * Says how much of the hardware work this machine actually proved it can do.
 *
 * An encoder the machine has is not the same as a filter chain that runs on it: a card can encode
 * HEVC and still refuse to scale ten-bit frames on the device, and the only sign of it is every
 * preview quietly costing the processor instead. Each chain is run once at startup against real
 * frames, so what is reported here is what happened rather than what was advertised.
 *
 * @param chains - What each chain did when it was tried.
 * @returns A count to show, how alarming it is, and the chains that refused.
 */
const describeChains = (chains: HardwareChain[]): Chains => {
  if (chains.length === 0) {
    return { label: 'Not checked', tone: 'quiet', refusals: [] };
  }

  const proved = chains.filter((chain) => chain.works);
  const refusals = chains
    .filter((chain) => !chain.works)
    .map((chain) => ({
      id: `${chain.accel}-${chain.shape}-${chain.bitDepth}`,
      what: `${chain.accel} cannot draw ${WORK[chain.shape]} at ${chain.bitDepth} bits`,
      reason:
        chain.reason === null || chain.reason === ''
          ? 'It produced nothing, and said nothing about why.'
          : chain.reason,
    }));

  return {
    label: `${proved.length} of ${chains.length} proved`,
    tone: refusals.length === 0 ? 'quiet' : 'warning',
    refusals,
  };
};

export { describeChains };
