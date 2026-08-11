import { z } from 'zod';

const ServerSettingsSchema = z.object({
  trustedOrigins: z.array(z.string().url()),
  cookieSecure: z.boolean(),
  setupCompletedAt: z.string().datetime().nullable(),
  catalogueApiKey: z.string().default(''),
});

type ServerSettings = z.infer<typeof ServerSettingsSchema>;

/**
 * A read/write view over the instance's persisted settings.
 *
 * Reads are async because the postgres-backed implementation may need to load
 * on first access. Callers should not cache the result: `trustedOrigins` is
 * resolved per request so that completing the setup wizard takes effect without
 * a restart.
 */
type SettingsStore = {
  read: () => Promise<ServerSettings>;
  write: (patch: Partial<ServerSettings>) => Promise<ServerSettings>;
};

const SETTINGS_KEY = 'server';

export type { ServerSettings, SettingsStore };

export { ServerSettingsSchema, SETTINGS_KEY };
