/**
 * The stretch of time a digest is about.
 *
 * `since` is where the last one finished reading, and `announce` says whether
 * anything found in it is worth telling anybody about.
 */
type DigestWindow = {
  since: Date;
  announce: boolean;
};

/**
 * Where the next digest should read from, and whether it may speak.
 *
 * The first run on any server is the case this exists for. A server that has
 * never sent a digest has no watermark, and treating that as the beginning of
 * time would make the first digest announce the entire library — forty
 * thousand episodes, at whatever hour the job happened to run, to everybody
 * in the house at once. Nothing in an existing library was added while
 * anybody was watching for it, so the first run reads nothing and only
 * records where it got to.
 *
 * That means one silent window per server, which is the correct trade: the
 * alternative is a first impression of this feature that guarantees it is
 * turned off before it ever says anything useful.
 *
 * @param readTo Where the last digest finished, or null on a fresh server.
 * @param now The moment this digest is running.
 */
const readDigestWindow = (readTo: string | null, now: Date): DigestWindow =>
  readTo === null ? { since: now, announce: false } : { since: new Date(readTo), announce: true };

export { readDigestWindow };

export type { DigestWindow };
