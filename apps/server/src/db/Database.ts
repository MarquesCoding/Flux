import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { authSchema, fluxSchema } from '@ValenceServer/db/Schema';

const schema = { ...authSchema, ...fluxSchema };

type FluxDatabase = ReturnType<typeof createDatabase>['db'];

/**
 * Opens the connection pool and binds the schema to it, which is the one place the server learns
 * where its database is.
 *
 * @param databaseUrl - Where Postgres is.
 * @returns The database, ready to query.
 */
const createDatabase = (databaseUrl: string) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  return { db, pool, schema };
};

export type { FluxDatabase };

export { createDatabase, schema };
