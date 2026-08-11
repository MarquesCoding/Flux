type Match = { name: string; pattern: RegExp }

/**
 * Checked in this order because a browser's own user agent string usually
 * names its rivals too: Edge and Opera both carry "Chrome", and Chrome
 * itself carries "Safari". The first match wins, so the browser that most
 * specifically identifies itself has to be checked first.
 *
 * "Chrome" itself is named Chromium rather than Chrome: modern browsers no
 * longer carry brand information in their user agent string precisely to
 * stop this kind of detection, so anything that matches here is only known
 * to be Chromium-based — it could just as easily be Brave, Vivaldi or Arc,
 * and calling all of them Chrome would be a guess this cannot back up.
 */
const BROWSERS: Match[] = [
  { name: 'Edge', pattern: /Edg\// },
  { name: 'Opera', pattern: /OPR\// },
  { name: 'Chromium', pattern: /Chrome\// },
  { name: 'Firefox', pattern: /Firefox\// },
  { name: 'Safari', pattern: /Safari\// },
]

const OPERATING_SYSTEMS: Match[] = [
  { name: 'iOS', pattern: /iPhone|iPad|iPod/ },
  { name: 'Android', pattern: /Android/ },
  { name: 'macOS', pattern: /Mac OS X/ },
  { name: 'Windows', pattern: /Windows/ },
  { name: 'Linux', pattern: /Linux/ },
]

/**
 * Names what a viewer is watching from, the way Jellyfin's session list
 * does — "Chrome on macOS" rather than a generic "Browser".
 *
 * Read from capability probes everywhere else in this codebase, but a device
 * profile's own capabilities say nothing a person would recognise their
 * laptop by. This is purely for that — a label an admin reads, never sent
 * for negotiation.
 */
const detectClientLabel = (userAgent: string): string => {
  const browser = BROWSERS.find((candidate) => candidate.pattern.test(userAgent))?.name ?? 'Browser'
  const os = OPERATING_SYSTEMS.find((candidate) => candidate.pattern.test(userAgent))?.name ?? null

  return os === null ? browser : `${browser} on ${os}`
}

/**
 * The same label, read from this browser.
 */
const detectFromNavigator = (): string => detectClientLabel(navigator.userAgent)

export default { detectClientLabel, detectFromNavigator }
