type DigestWindow = {
  since: Date;
  announce: boolean;
};

/**
 * Decides where the next digest reads from and whether it may say anything at all. A server that has
 * never sent one starts its window now and stays silent: the first digest after Valence is installed
 * would otherwise announce the entire library as new.
 *
 * @param readTo Where the last digest finished, or null on a fresh server.
 * @param now The moment this digest is running.
 */
const readDigestWindow = (readTo: string | null, now: Date): DigestWindow =>
  readTo === null ? { since: now, announce: false } : { since: new Date(readTo), announce: true };

export { readDigestWindow };
