/**
 * Extracts the shared secret from an `otpauth://` URI.
 *
 * The secret must always be offered as text alongside the QR code: someone
 * setting up an authenticator on the same device they are reading from cannot
 * scan the screen they are looking at, and a screen reader cannot read a QR
 * code at all.
 */
const readTotpSecret = (totpURI: string): string => {
  const parsed = URL.parse(totpURI);

  return parsed?.searchParams.get('secret') ?? '';
};

/**
 * Groups a secret into blocks of four so it can be read aloud and typed
 * without losing position.
 */
const formatTotpSecret = (secret: string): string => (secret.match(/.{1,4}/g) ?? []).join(' ');

export { readTotpSecret, formatTotpSecret };
