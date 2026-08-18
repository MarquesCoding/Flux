const UUID_VERSION_BYTE = 6;

const UUID_VARIANT_BYTE = 8;

/**
 * Makes a random identifier without requiring a secure context.
 *
 * `crypto.randomUUID` is only defined where the page is a secure context, which
 * a self-hosted Flux reached at `http://192.168.1.10` is not — browsers grant
 * that status to `localhost` and to HTTPS, and to nothing else. Calling it on a
 * plain LAN address throws, and the throw unmounted the whole application: the
 * splash screen appeared, presence started, and the tab went blank.
 *
 * `crypto.getRandomValues` carries no such restriction, so the same version 4
 * layout is assembled from it directly: the version nibble in byte 6, the
 * variant bits in byte 8.
 *
 * @returns A version 4 UUID.
 */
const randomId = (): string => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));

  bytes[UUID_VERSION_BYTE] = ((bytes[UUID_VERSION_BYTE] ?? 0) & 0x0f) | 0x40;
  bytes[UUID_VARIANT_BYTE] = ((bytes[UUID_VARIANT_BYTE] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export { randomId };
