/**
 * Works through a list with a fixed number of things happening at once, keeping the answers in the
 * order the items were given rather than the order they finished. This is what stops a scan of ten
 * thousand files from opening ten thousand of anything at once.
 *
 * @param items - What to work through.
 * @param limit - How many to have in flight at once, at least one.
 * @param work - What to do with each, given the item and where it sits in the list.
 * @returns The answers, in the order of the items.
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
