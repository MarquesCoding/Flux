type SoundListener = (isOwner: boolean) => void;

type Claimant = { id: symbol; tell: SoundListener };

const claimants: Claimant[] = [];

const announce = (): void => {
  const owner = claimants.at(-1);

  for (const claimant of claimants) {
    claimant.tell(claimant.id === owner?.id);
  }
};

/**
 * Puts a clip in the queue for being the one thing on the page allowed to make a noise, and answers
 * with how to leave it. The newest claim wins, so a dialog opening over a page takes the sound from
 * whatever was behind it and hands it back on the way out rather than the two talking over
 * each other.
 *
 * @param tell - Told whether this clip is the one that may be heard, now and whenever that changes.
 * @returns How to give up the claim.
 */
const claimSound = (tell: SoundListener): (() => void) => {
  const id = Symbol('preview');

  claimants.push({ id, tell });
  announce();

  return () => {
    const at = claimants.findIndex((claimant) => claimant.id === id);

    if (at !== -1) {
      claimants.splice(at, 1);
    }

    announce();
  };
};

/**
 * Forgets every claim, for a test that would otherwise inherit the last one.
 */
const forgetSoundClaims = (): void => {
  claimants.length = 0;
};

export type { SoundListener };

export { claimSound, forgetSoundClaims };
