const TIGHT_SHARE_OF_WHAT_IS_LEFT = 0.6;

const VERDICTS = ['fits', 'tight', 'willNotFit', 'unknown'] as const;

type SpaceVerdict = (typeof VERDICTS)[number];

type JudgeFreeSpaceOptions = {
  bytes: number | null;
  freeBytes: number | null;
};

/**
 * Whether a download will fit, and whether it should give somebody pause.
 *
 * A size in small grey text is documentation, not a warning. What prevents the mistake is the
 * comparison: "58 GB, and you have 41 GB free" is a different sentence from "58 GB", and it is the
 * one somebody acts on.
 *
 * Anything taking most of what is left is called tight rather than fine, because filling a device
 * to the last gigabyte breaks the next thing that needs room and nothing will connect that to this
 * decision. Where the free space is not known — a browser that would not say — nothing is claimed.
 *
 * @param options - What it would cost, and what there is.
 * @returns Whether it fits, is tight, will not fit, or cannot be judged.
 */
const judgeFreeSpace = ({ bytes, freeBytes }: JudgeFreeSpaceOptions): SpaceVerdict => {
  if (bytes === null || freeBytes === null || bytes <= 0 || freeBytes <= 0) {
    return 'unknown';
  }

  if (bytes > freeBytes) {
    return 'willNotFit';
  }

  return bytes > freeBytes * TIGHT_SHARE_OF_WHAT_IS_LEFT ? 'tight' : 'fits';
};

export type { JudgeFreeSpaceOptions, SpaceVerdict };

export { VERDICTS, judgeFreeSpace };
