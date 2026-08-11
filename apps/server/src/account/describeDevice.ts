/**
 * The browsers worth naming, and what gives them away.
 *
 * Order matters: every browser claims to be several others. Chrome says it is
 * Safari, Edge says it is Chrome, and both say they are Mozilla — so the most
 * specific claim has to be tested first.
 */
const BROWSERS = [
  { named: 'Edge', marks: ['Edg/'] },
  { named: 'Opera', marks: ['OPR/', 'Opera'] },
  { named: 'Firefox', marks: ['Firefox/'] },
  { named: 'Chrome', marks: ['Chrome/', 'Chromium/'] },
  { named: 'Safari', marks: ['Safari/'] },
] as const

/**
 * The machines worth naming.
 */
const SYSTEMS = [
  { named: 'iPhone', marks: ['iPhone'] },
  { named: 'iPad', marks: ['iPad'] },
  { named: 'Android', marks: ['Android'] },
  { named: 'macOS', marks: ['Macintosh', 'Mac OS X'] },
  { named: 'Windows', marks: ['Windows'] },
  { named: 'Linux', marks: ['Linux', 'X11'] },
] as const

/**
 * How much of an unrecognised agent to keep.
 */
const KEPT = 40

/**
 * What to call a device, from what its browser said about itself.
 *
 * A guess, and only ever a label. What a client can play is decided from a
 * profile the client declares rather than from this (ADR-0011); the job here
 * is to tell one line of a list from another, so somebody looking at four
 * sessions can see which one is the television.
 */
const describeDevice = (userAgent: string | null | undefined): string => {
  const said = userAgent ?? ''

  const browser = BROWSERS.find((candidate) =>
    candidate.marks.some((mark) => said.includes(mark)),
  )?.named

  const system = SYSTEMS.find((candidate) =>
    candidate.marks.some((mark) => said.includes(mark)),
  )?.named

  if (browser === undefined && system === undefined) {
    // Something signed in without saying what it was. Better to admit that
    // than to invent a name for it.
    return said.trim() === '' ? 'Unknown device' : said.slice(0, KEPT)
  }

  if (browser === undefined) {
    return system ?? 'Unknown device'
  }

  return system === undefined ? browser : `${browser} on ${system}`
}

export { describeDevice }
