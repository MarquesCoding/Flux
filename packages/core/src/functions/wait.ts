/**
 * Waits for a while before carrying on, for the places that have to ask again rather than hold a
 * request open — a retry after a rate limit, or a render that is asked about until it is finished.
 *
 * @param milliseconds - How long to wait.
 */
const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

export { wait };
