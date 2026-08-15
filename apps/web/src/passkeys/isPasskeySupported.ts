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
