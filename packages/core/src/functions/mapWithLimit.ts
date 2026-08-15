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
