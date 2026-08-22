type Match = { name: string; pattern: RegExp };

const OPERATING_SYSTEMS: Match[] = [
  { name: 'macOS', pattern: /Mac OS X|Macintosh/ },
  { name: 'Windows', pattern: /Windows/ },
  { name: 'Linux', pattern: /Linux|X11/ },
];

/**
 * What to call this client in the sessions list an operator reads.
 *
 * A browser says which browser it is, because that is the interesting part of "Chrome on macOS" —
 * the same machine runs several and they are different things to be signed in from. A desktop client
 * is only ever Valence, so the browser half would be both wrong and useless: naming the WebView an
 * operator never chose tells them nothing about which device is playing something.
 *
 * @param userAgent - What the WebView says about itself, which still carries the operating system.
 * @returns The device as a person would describe it.
 */
const describeThisDesktop = (userAgent: string): string => {
  const os = OPERATING_SYSTEMS.find((candidate) => candidate.pattern.test(userAgent))?.name ?? null;

  return os === null ? 'Valence for desktop' : `Valence on ${os}`;
};

export { describeThisDesktop };
