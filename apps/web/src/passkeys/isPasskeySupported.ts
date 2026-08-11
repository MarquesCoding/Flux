/**
 * Reports whether this browser can register a passkey here.
 *
 * WebAuthn requires a secure context: HTTPS, or localhost. A self-hosted
 * instance reached at `http://192.168.1.40:8420` therefore cannot use
 * passkeys at all, which is a common enough deployment that the interface must
 * explain it rather than offer a button that fails when pressed.
 */
const isPasskeySupported = (): boolean =>
  typeof window !== 'undefined' &&
  window.isSecureContext &&
  typeof window.PublicKeyCredential === 'function'

/**
 * Explains why passkeys are unavailable, or null when they are available.
 */
const describePasskeyUnavailability = (): string | null => {
  if (typeof window === 'undefined') {
    return 'Passkeys are not available here.'
  }

  if (!window.isSecureContext) {
    return 'Passkeys need a secure connection. Reach Flux over HTTPS, or on localhost, to add one.'
  }

  if (typeof window.PublicKeyCredential !== 'function') {
    return 'This browser does not support passkeys.'
  }

  return null
}

export { isPasskeySupported, describePasskeyUnavailability }
