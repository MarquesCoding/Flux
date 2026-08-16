import { z } from 'zod';

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

type SettingsStore = {
  read: () => Promise<ServerSettings>;
  write: (patch: Partial<ServerSettings>) => Promise<ServerSettings>;
};

const SETTINGS_KEY = 'server';

export type { ServerSettings, SettingsStore };

export { ServerSettingsSchema, SETTINGS_KEY };
