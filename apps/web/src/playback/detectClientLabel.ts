type Match = { name: string; pattern: RegExp };

const BROWSERS: Match[] = [
  { name: 'Edge', pattern: /Edg\// },
  { name: 'Opera', pattern: /OPR\// },
  { name: 'Chromium', pattern: /Chrome\// },
  { name: 'Firefox', pattern: /Firefox\// },
  { name: 'Safari', pattern: /Safari\// },
];

const OPERATING_SYSTEMS: Match[] = [
  { name: 'iOS', pattern: /iPhone|iPad|iPod/ },
  { name: 'Android', pattern: /Android/ },
  { name: 'macOS', pattern: /Mac OS X/ },
  { name: 'Windows', pattern: /Windows/ },
  { name: 'Linux', pattern: /Linux/ },
];

/**
 * Names what a viewer is watching from, the way Jellyfin's session list does — "Chrome on macOS"
 * rather than a generic "Browser".
 */
const detectClientLabel = (userAgent: string): string => {
  const browser =
    BROWSERS.find((candidate) => candidate.pattern.test(userAgent))?.name ?? 'Browser';
  const os = OPERATING_SYSTEMS.find((candidate) => candidate.pattern.test(userAgent))?.name ?? null;

  return os === null ? browser : `${browser} on ${os}`;
};

/**
 * The same label, read from this browser.
 */
const detectFromNavigator = (): string => detectClientLabel(navigator.userAgent);

export { detectClientLabel, detectFromNavigator };
