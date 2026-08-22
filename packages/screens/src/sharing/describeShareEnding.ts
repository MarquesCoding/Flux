import { ClockIcon, EyeSlashIcon, LinkBreakIcon } from '@phosphor-icons/react';
import { SHARE_ENDING_SAID } from '@FluxContracts/schemas/Share';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import type { ShareEnding } from '@FluxContracts/schemas/Share';

type EndingTold = {
  said: string;
  detail: string;
  icon: PhosphorIcon;
};

const TOLD: Record<ShareEnding, { detail: string; icon: PhosphorIcon }> = {
  withdrawn: {
    detail: 'Somebody stopped it working. Whoever sent it can send another.',
    icon: LinkBreakIcon,
  },
  expired: {
    detail:
      'It was made to last a while, and that while is over. Whoever sent it can send another.',
    icon: ClockIcon,
  },
  spent: {
    detail:
      'It was made to be opened a set number of times, and it has been. Whoever sent it can send another.',
    icon: EyeSlashIcon,
  },
};

/**
 * Says what a guest should see for a link that has stopped working. The three ways a link can end
 * are three different things to have happened — somebody decided, time passed, or it was opened as
 * often as it was meant to be — and a guest reading one of them is usually working out whether to
 * ask for another link or whether they have simply arrived too late.
 *
 * The sentence itself comes from the contract rather than being written again here, so that a guest
 * and anything else reading the API are told the same thing.
 *
 * A withdrawn link says somebody stopped it rather than naming them. Whoever made a link is not
 * necessarily whoever withdrew it — an administrator may withdraw anybody's — and which of them did
 * is about how the household is run, which is not a guest's business.
 *
 * @param ended - How the link ended.
 * @returns What to show: the sentence, what follows it, and the mark above it.
 */
const describeShareEnding = (ended: ShareEnding): EndingTold => ({
  said: SHARE_ENDING_SAID[ended],
  ...TOLD[ended],
});

export type { EndingTold };

export { describeShareEnding };
