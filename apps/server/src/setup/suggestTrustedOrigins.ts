const WEB_DEV_PORT = '5173'

/**
 * Suggests the origins an operator most likely needs to trust, given the
 * origin they reached the server on.
 *
 * A self-hosted instance is commonly reached on several origins at once — a
 * LAN address, a Tailscale name, and a real domain. Missing one is the most
 * common cause of a login that appears to do nothing, so the wizard offers the
 * detected origin plus the development client rather than the detected origin
 * alone.
 */
const suggestTrustedOrigins = (detectedOrigin: string): string[] => {
  const suggestions = [detectedOrigin]

  const parsed = URL.parse(detectedOrigin)

  if (parsed !== null && parsed.port !== WEB_DEV_PORT) {
    suggestions.push(`${parsed.protocol}//${parsed.hostname}:${WEB_DEV_PORT}`)
  }

  return [...new Set(suggestions)]
}

export default { suggestTrustedOrigins, WEB_DEV_PORT }
