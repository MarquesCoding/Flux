import { z } from 'zod'

const HealthSchema = z.object({ version: z.string() })

/**
 * What an unreleased build calls itself.
 *
 * A version of nought is what a package that has never been released reports,
 * and printing it on a sign-in screen says less than nothing. Somebody running
 * from source should see that they are.
 */
const LOCAL = 'local.dev'

/**
 * The versions that mean "this was never released".
 */
const UNRELEASED = new Set(['0.0.0', 'dev', ''])

/**
 * Says a version the way it should be read.
 */
const describeVersion = (reported: string): string =>
  UNRELEASED.has(reported.trim()) ? LOCAL : reported

/**
 * Which version of Flux this is.
 *
 * Read from the server rather than baked into the page, so what a browser
 * shows is what is actually running: a client cached from last week would
 * otherwise report last week's number.
 */
const readVersion = async (): Promise<string | null> => {
  try {
    const response = await fetch('/api/health', { headers: { accept: 'application/json' } })

    if (!response.ok) {
      return null
    }

    return describeVersion(HealthSchema.parse(await response.json()).version)
  } catch {
    return null
  }
}

export { readVersion, describeVersion, LOCAL }
