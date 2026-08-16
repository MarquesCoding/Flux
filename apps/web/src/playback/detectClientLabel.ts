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
 * Names what a viewer is watching from — "Chrome on macOS" rather than a generic "Browser" — for the
 * sessions an operator sees and the devices an account can review. Built from the user agent, in the
 * shape other media servers use, so an operator reading it recognises what they are looking at.
 *
 * @param userAgent - What the browser says about itself.
 * @returns The device as a person would describe it.
 */
const detectClientLabel = (userAgent: string): string => {
  const browser =
    BROWSERS.find((candidate) => candidate.pattern.test(userAgent))?.name ?? 'Browser';
  const os = OPERATING_SYSTEMS.find((candidate) => candidate.pattern.test(userAgent))?.name ?? null;

  return os === null ? browser : `${browser} on ${os}`;
};

/**
 * Reads the device label from this browser, so a session list says "Firefox on macOS" rather than a
 * user agent string.
 */
const detectFromNavigator = (): string => detectClientLabel(navigator.userAgent);

export { detectClientLabel, detectFromNavigator };
