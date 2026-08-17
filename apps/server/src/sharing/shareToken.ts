import { createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32;

/**
 * Makes a share token. The link is the credential, and it is expected to travel to somebody on the
 * internet — so it is long enough that guessing one is not a strategy, and made of bytes a URL can
 * carry without escaping.
 *
 * @returns The token, in the form it is given to whoever creates the share.
 */
const makeShareToken = (): string => randomBytes(TOKEN_BYTES).toString('base64url');

/**
 * Hashes a share token for storage. Stored hashed like any other credential: a database somebody has
 * read should not hand them working links to the library, and nothing needs the original back —
 * resolving a share hashes what arrived and looks for the match.
 *
 * @param token - The token as it travels in a link.
 * @returns Its hash, as stored.
 */
const hashShareToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export { makeShareToken, hashShareToken, TOKEN_BYTES };
