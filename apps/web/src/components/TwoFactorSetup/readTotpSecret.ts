const readTotpSecret = (totpURI: string): string => {
  const parsed = URL.parse(totpURI);

  return parsed?.searchParams.get('secret') ?? '';
};

/**
 * Groups a secret into blocks of four so it can be read aloud and typed without losing position.
 */
const formatTotpSecret = (secret: string): string => (secret.match(/.{1,4}/g) ?? []).join(' ');

export { readTotpSecret, formatTotpSecret };
