import { eq } from 'drizzle-orm';
import { serverSetting } from '@FluxServer/db/Schema';
import { ServerSettingsSchema, SETTINGS_KEY } from './ServerSettings';
import type { ServerSettings, SettingsStore } from './ServerSettings';
import type { FluxDatabase } from '@FluxServer/db/Database';

type CreateDatabaseSettingsStoreOptions = {
  db: FluxDatabase;
  defaults: ServerSettings;
};

/**
 * Builds a settings store backed by the `server_setting` table.
 *
 * Values are validated on read, so a row hand-edited into an invalid shape
 * falls back to the configured defaults rather than crashing the server on a
 * request. A self-hosted instance that will not boot is worse than one running
 * on defaults with a warning.
 */
const createDatabaseSettingsStore = ({
  db,
  defaults,
}: CreateDatabaseSettingsStoreOptions): SettingsStore => {
  const read = async (): Promise<ServerSettings> => {
    const rows = await db
      .select()
      .from(serverSetting)
      .where(eq(serverSetting.key, SETTINGS_KEY))
      .limit(1);

    const row = rows[0];

    if (row === undefined) {
      return defaults;
    }

    const parsed = ServerSettingsSchema.safeParse(row.value);

    return parsed.success ? parsed.data : defaults;
  };

  const write = async (patch: Partial<ServerSettings>): Promise<ServerSettings> => {
    const next = ServerSettingsSchema.parse({ ...(await read()), ...patch });

    await db
      .insert(serverSetting)
      .values({ key: SETTINGS_KEY, value: next, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: serverSetting.key,
        set: { value: next, updatedAt: new Date() },
      });

    return next;
  };

  return { read, write };
};

export { createDatabaseSettingsStore };
