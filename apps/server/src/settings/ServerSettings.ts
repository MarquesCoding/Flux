import { z } from 'zod';

/**
 * What the instance remembers about itself between restarts.
 *
 * `pushPublicKey` and `pushPrivateKey` are the identity push services check
 * this server by. Generated once on the first run that needs them and kept
 * for ever after, because every subscription a browser takes out is against
 * that public key: replacing the pair silently stops every phone in the house
 * from being reachable, with nothing to indicate why. They live here rather
 * than in the environment so that a server nobody configured still works — an
 * operator should not have to produce a keypair by hand to be told about new
 * media.
 *
 * `mediaDigestReadTo` is how far the new-media digest has read, and is null on
 * a server that has never sent one. That is deliberately not treated as the
 * beginning of time: the first run sets it to now and says nothing, because
 * everything already in a library was not added while anybody was watching,
 * and a first digest announcing forty thousand episodes is a notification
 * nobody wants and a lesson about this feature nobody forgets.
 */
const ServerSettingsSchema = z.object({
  trustedOrigins: z.array(z.string().url()),
  cookieSecure: z.boolean(),
  setupCompletedAt: z.string().datetime().nullable(),
  catalogueApiKey: z.string().default(''),
  hardwareAccel: z.string().default(''),
  seededJobTriggerKinds: z.array(z.string()).default([]),
  seededRoleNames: z.array(z.string()).default([]),
  pushPublicKey: z.string().default(''),
  pushPrivateKey: z.string().default(''),
  mediaDigestReadTo: z.string().datetime().nullable().default(null),
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
