/**
 * Whether this browser can use passkeys at all, which needs both the credential machinery and a
 * secure context — the machinery exists over plain HTTP but refuses to do anything.
 *
 * @returns Whether passkeys can be offered.
 */
const isPasskeySupported = (): boolean =>
  typeof window !== 'undefined' &&
  window.isSecureContext &&
  typeof window.PublicKeyCredential === 'function';

/**
 * Explains why passkeys are unavailable, or null when they are available.
 */
const describePasskeyUnavailability = (): string | null => {
  if (typeof window === 'undefined') {
    return 'Passkeys are not available here.';
  }

  if (!window.isSecureContext) {
    return 'Passkeys need a secure connection. Reach Flux over HTTPS, or on localhost, to add one.';
  }

  if (typeof window.PublicKeyCredential !== 'function') {
    return 'This browser does not support passkeys.';
  }

  return null;
};

export { isPasskeySupported, describePasskeyUnavailability };
