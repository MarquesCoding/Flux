/**
 * Says when something happened the way somebody would read it rather than as a timestamp, and says
 * so vaguely where the moment cannot be read at all — a list is not the place to show a reader that
 * a date failed to parse.
 *
 * @param when - When it happened.
 * @returns The phrase to show.
 */
const saidWhen = (when: string): string => {
  const at = new Date(when);

  return Number.isNaN(at.getTime())
    ? 'at some point'
    : at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

export { saidWhen };
