import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { authSchema, fluxSchema } from '@FluxServer/db/Schema';

const schema = { ...authSchema, ...fluxSchema };

type FluxDatabase = ReturnType<typeof createDatabase>['db'];

/**
 * Opens the Postgres connection pool and binds the Drizzle schema to it.
 */
const createDatabase = (databaseUrl: string) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  return { db, pool, schema };
};

export type { FluxDatabase };

export { createDatabase, schema };
