/**
 * Reads the shared secret out of an authenticator URI, for anybody entering it by hand rather than
 * scanning the code.
 *
 * @param totpURI - The URI enrollment produced.
 * @returns The secret, or an empty string where the URI carries none.
 */
const readTotpSecret = (totpURI: string): string => {
  const parsed = URL.parse(totpURI);

  return parsed?.searchParams.get('secret') ?? '';
};

/**
 * Groups a secret into blocks of four so it can be read aloud and typed without losing one's place in
 * it.
 *
 * @param secret - The secret as enrollment gave it.
 * @returns It, in blocks of four.
 */
const formatTotpSecret = (secret: string): string => (secret.match(/.{1,4}/g) ?? []).join(' ');

export { readTotpSecret, formatTotpSecret };
