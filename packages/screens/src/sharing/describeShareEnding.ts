import { Clock01Icon, Unlink01Icon, ViewOffIcon } from '@hugeicons/core-free-icons';
import { SHARE_ENDING_SAID } from '@ValenceContracts/schemas/Share';
import type { IconGlyph } from '@ValenceUI/Icon.types';
import type { ShareEnding } from '@ValenceContracts/schemas/Share';

type EndingTold = {
  said: string;
  detail: string;
  icon: IconGlyph;
};

const TOLD: Record<ShareEnding, { detail: string; icon: IconGlyph }> = {
  withdrawn: {
    detail: 'Somebody stopped it working. Whoever sent it can send another.',
    icon: Unlink01Icon,
  },
  expired: {
    detail:
      'It was made to last a while, and that while is over. Whoever sent it can send another.',
    icon: Clock01Icon,
  },
  spent: {
    detail:
      'It was made to be opened a set number of times, and it has been. Whoever sent it can send another.',
    icon: ViewOffIcon,
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
