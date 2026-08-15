import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import { jobTrigger } from '@FluxServer/db/Schema';
import { ScheduleTriggerSchema } from './scheduleTrigger';
import type { FluxDatabase } from '@FluxServer/db/Database';
import type { JobTriggerStore } from './JobTriggerStore';

/**
 * Job triggers in Postgres.
 */
const createDatabaseJobTriggerStore = (db: FluxDatabase): JobTriggerStore => ({
  list: async () => {
    const rows = await db.select().from(jobTrigger).orderBy(asc(jobTrigger.createdAt));

    return rows.flatMap((row) => {
      const parsed = ScheduleTriggerSchema.safeParse(row.trigger);

      return parsed.success ? [{ id: row.id, kind: row.kind, trigger: parsed.data }] : [];
    });
  },

  add: async (kind, trigger) => {
    const id = randomUUID();

    await db.insert(jobTrigger).values({ id, kind, trigger });

    return { id, kind, trigger };
  },

  remove: async (kind, triggerId) => {
    const removed = await db
      .delete(jobTrigger)
      .where(and(eq(jobTrigger.id, triggerId), eq(jobTrigger.kind, kind)))
      .returning({ id: jobTrigger.id });

    return removed.length > 0;
  },
});

export { createDatabaseJobTriggerStore };
