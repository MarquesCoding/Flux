type CarriedOn = {
  nowPlaying: string | null;
  carriedOnTo: string | null;
  carriedOn: number;
};

/**
 * How many episodes have followed on their own since somebody last chose one.
 *
 * Worked out from what is playing rather than counted at each place playback starts, because there
 * are nine such places and a tenth added later would quietly never reset the count — the viewer
 * would then be asked whether they are still watching a film they had just picked themselves.
 *
 * The rule is simple: if what is playing is the thing that was carried on to, the run continues; if
 * it is anything else, somebody made a choice and the run is over.
 *
 * @param nowPlaying - What is playing, or null where nothing is.
 * @param carriedOnTo - What was last started by the player finishing, rather than by a person.
 * @param carriedOn - How long the run was before this.
 * @returns How long the run is now.
 */
const countCarriedOn = ({ nowPlaying, carriedOnTo, carriedOn }: CarriedOn): number =>
  nowPlaying !== null && nowPlaying === carriedOnTo ? carriedOn : 0;

export type { CarriedOn };

export { countCarriedOn };
