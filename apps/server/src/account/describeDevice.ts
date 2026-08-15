const BROWSERS = [
  { named: 'Edge', marks: ['Edg/'] },
  { named: 'Opera', marks: ['OPR/', 'Opera'] },
  { named: 'Firefox', marks: ['Firefox/'] },
  { named: 'Chrome', marks: ['Chrome/', 'Chromium/'] },
  { named: 'Safari', marks: ['Safari/'] },
] as const;

const SYSTEMS = [
  { named: 'iPhone', marks: ['iPhone'] },
  { named: 'iPad', marks: ['iPad'] },
  { named: 'Android', marks: ['Android'] },
  { named: 'macOS', marks: ['Macintosh', 'Mac OS X'] },
  { named: 'Windows', marks: ['Windows'] },
  { named: 'Linux', marks: ['Linux', 'X11'] },
] as const;

const KEPT = 40;

/**
 * What to call a device, from what its browser said about itself.
 */
const describeDevice = (userAgent: string | null | undefined): string => {
  const said = userAgent ?? '';

  const browser = BROWSERS.find((candidate) =>
    candidate.marks.some((mark) => said.includes(mark)),
  )?.named;

  const system = SYSTEMS.find((candidate) =>
    candidate.marks.some((mark) => said.includes(mark)),
  )?.named;

  if (browser === undefined && system === undefined) {
    return said.trim() === '' ? 'Unknown device' : said.slice(0, KEPT);
  }

  if (browser === undefined) {
    return system ?? 'Unknown device';
  }

  return system === undefined ? browser : `${browser} on ${system}`;
};

export { describeDevice };
