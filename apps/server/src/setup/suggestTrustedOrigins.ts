const WEB_DEV_PORT = '5173';

/**
 * Suggests the origins an operator most likely needs to trust, given the origin they reached the
 * server on.
 */
const suggestTrustedOrigins = (detectedOrigin: string): string[] => {
  const suggestions = [detectedOrigin];

  const parsed = URL.parse(detectedOrigin);

  if (parsed !== null && parsed.port !== WEB_DEV_PORT) {
    suggestions.push(`${parsed.protocol}//${parsed.hostname}:${WEB_DEV_PORT}`);
  }

  return [...new Set(suggestions)];
};

export { suggestTrustedOrigins, WEB_DEV_PORT };
