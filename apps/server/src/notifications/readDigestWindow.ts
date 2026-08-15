type DigestWindow = {
  since: Date;
  announce: boolean;
};

/**
 * Where the next digest should read from, and whether it may speak.
 *
 * @param readTo Where the last digest finished, or null on a fresh server.
 * @param now The moment this digest is running.
 */
const readDigestWindow = (readTo: string | null, now: Date): DigestWindow =>
  readTo === null ? { since: now, announce: false } : { since: new Date(readTo), announce: true };

export { readDigestWindow };
