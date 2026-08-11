import { z } from 'zod'

const ServerSettingsSchema = z.object({
  trustedOrigins: z.array(z.string().url()),
  cookieSecure: z.boolean(),
  setupCompletedAt: z.string().datetime().nullable(),
  /**
   * The key a metadata provider talks to its catalogue with.
   *
   * Empty by default. Looking up what is in someone's library means telling a
   * third party about it, which is a decision the operator makes deliberately
   * rather than one Flux makes for them.
   */
  catalogueApiKey: z.string().default(''),
  /**
   * The job kinds whose default triggers have already been installed.
   *
   * Recorded per kind rather than as one "defaults done" flag so that a job
   * added in a later version still gets its own defaults on the next boot,
   * while a kind whose triggers the operator deleted stays deleted — a
   * schedule that comes back after being removed is worse than no default
   * at all.
   */
  seededJobTriggerKinds: z.array(z.string()).default([]),
})

type ServerSettings = z.infer<typeof ServerSettingsSchema>

/**
 * A read/write view over the instance's persisted settings.
 *
 * Reads are async because the postgres-backed implementation may need to load
 * on first access. Callers should not cache the result: `trustedOrigins` is
 * resolved per request so that completing the setup wizard takes effect without
 * a restart.
 */
type SettingsStore = {
  read: () => Promise<ServerSettings>
  write: (patch: Partial<ServerSettings>) => Promise<ServerSettings>
}

const SETTINGS_KEY = 'server'

export type { ServerSettings, SettingsStore }

export default { ServerSettingsSchema, SETTINGS_KEY }
