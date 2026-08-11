/**
 * Runs work over a list, several at a time but never all at once.
 *
 * Media work is measured in whole processes: one ffmpeg per file, each willing
 * to take every core and a gigabyte with it. Doing them one after another
 * leaves a machine idle; doing them all at once is how a transcoder dies
 * halfway through a library and takes the queue's memory of what it was doing
 * with it.
 *
 * Order is preserved in the results even though the work is not done in order,
 * so a caller can pair answers with what it asked about.
 *
 * A limit below one is treated as one. Nought would mean nothing ever runs.
 */
const mapWithLimit = async <Item, Answer>(
  items: readonly Item[],
  limit: number,
  work: (item: Item, at: number) => Promise<Answer>,
): Promise<Answer[]> => {
  const answers: Answer[] = new Array<Answer>(items.length);
  const width = Math.max(1, Math.floor(limit));
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const at = next;

      next += 1;

      const item = items[at];

      if (item === undefined) {
        continue;
      }

      answers[at] = await work(item, at);
    }
  };

  await Promise.all(Array.from({ length: Math.min(width, items.length) }, () => worker()));

  return answers;
};

export { mapWithLimit };
