const WEB_DEV_PORT = '5173';

/**
 * Suggests the addresses an operator most likely needs to trust, worked out from the one they
 * reached the server on — so setting up on a home network is a matter of confirming an address
 * rather than knowing what one is.
 *
 * @param origin - The address the setup page was reached at.
 * @returns The origins worth offering, most likely first.
 */
const suggestTrustedOrigins = (detectedOrigin: string): string[] => {
  const suggestions = [detectedOrigin];

  const parsed = URL.parse(detectedOrigin);

  if (parsed !== null && parsed.port !== WEB_DEV_PORT) {
    suggestions.push(`${parsed.protocol}//${parsed.hostname}:${WEB_DEV_PORT}`);
  }

  return [...new Set(suggestions)];
};

export { suggestTrustedOrigins };
