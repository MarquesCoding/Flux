import { randomBytes, randomUUID } from 'node:crypto';
import { and, asc, desc, eq, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { toIso } from '@FluxCore/functions/toIso';
import { webhookDelivery, webhookSubscription } from '@FluxServer/db/Schema';
import { WebhookEventSchema, WebhookPresetSchema } from '@FluxContracts/schemas/Webhook';
import type { FluxDatabase } from '@FluxServer/db/Database';
import type { WebhookSubscription } from '@FluxContracts/schemas/Webhook';
import type { WebhookStore } from './WebhookStore';

/**
 * How the signing secret announces what it is.
 *
 * The prefix is for the person who finds one in a config file six months
 * later and has to work out what they are looking at, and for the scanners
 * that recognise a leaked credential by its shape.
 */
const WEBHOOK_SECRET_PREFIX = 'whsec_';

/**
 * How much randomness a secret carries.
 *
 * Thirty-two bytes, which is the digest size of the HMAC it keys. More would
 * be hashed down to this anyway; less would be the weakest part of a
 * signature that is otherwise sound.
 */
const WEBHOOK_SECRET_BYTES = 32;

const StoredEventsSchema = z.array(WebhookEventSchema);

/**
 * Subscriptions in Postgres.
 *
 * A row whose stored events or preset no longer parse is dropped from the
 * listing rather than failing the read, the same as a job trigger: an event
 * removed from the catalogue in a later version should quietly stop counting,
 * not make the whole page unopenable. Such a row still exists and can still
 * be deleted — it simply stops being delivered to, which is the safe
 * direction for a thing whose job is to make outbound requests.
 */
const createDatabaseWebhookStore = (db: FluxDatabase): WebhookStore => {
  const readRow = (row: typeof webhookSubscription.$inferSelect): WebhookSubscription[] => {
    const events = StoredEventsSchema.safeParse(row.events);
    const preset = WebhookPresetSchema.safeParse(row.preset);

    if (!events.success || !preset.success || events.data.length === 0) {
      return [];
    }

    return [
      {
        id: row.id,
        name: row.name,
        url: row.url,
        preset: preset.data,
        events: events.data,
        enabled: row.enabled,
        createdAt: row.createdAt.toISOString(),
        lastAttemptAt: toIso(row.lastAttemptAt),
        lastStatus: row.lastStatus,
        lastError: row.lastError,
      },
    ];
  };

  return {
    list: async () => {
      const rows = await db
        .select()
        .from(webhookSubscription)
        .orderBy(asc(webhookSubscription.createdAt));

      return rows.flatMap((row) => readRow(row));
    },

    create: async ({ name, url, preset, events }) => {
      const id = randomUUID();
      const secret = `${WEBHOOK_SECRET_PREFIX}${randomBytes(WEBHOOK_SECRET_BYTES).toString('base64url')}`;
      const createdAt = new Date();

      await db
        .insert(webhookSubscription)
        .values({ id, name, url, secret, preset, events, enabled: true, createdAt });

      return {
        secret,
        subscription: {
          id,
          name,
          url,
          preset,
          events,
          enabled: true,
          createdAt: createdAt.toISOString(),
          lastAttemptAt: null,
          lastStatus: null,
          lastError: null,
        },
      };
    },

    update: async (id, change) => {
      const changed = await db
        .update(webhookSubscription)
        .set({ enabled: change.enabled })
        .where(eq(webhookSubscription.id, id))
        .returning();

      return changed.flatMap((row) => readRow(row))[0] ?? null;
    },

    remove: async (id) => {
      const removed = await db
        .delete(webhookSubscription)
        .where(eq(webhookSubscription.id, id))
        .returning({ id: webhookSubscription.id });

      return removed.length > 0;
    },

    listenersFor: async (event) => {
      const rows = await db
        .select()
        .from(webhookSubscription)
        .where(eq(webhookSubscription.enabled, true));

      return rows
        .flatMap((row) => readRow(row))
        .filter((subscription) => subscription.events.includes(event))
        .map((subscription) => subscription.id);
    },

    readTarget: async (id) => {
      const rows = await db
        .select()
        .from(webhookSubscription)
        .where(and(eq(webhookSubscription.id, id), eq(webhookSubscription.enabled, true)));

      const row = rows[0];

      if (row === undefined) {
        return null;
      }

      const preset = WebhookPresetSchema.safeParse(row.preset);

      return preset.success ? { url: row.url, preset: preset.data, secret: row.secret } : null;
    },

    recordAttempt: async (id, attempt) => {
      await db
        .update(webhookSubscription)
        .set({
          lastAttemptAt: new Date(),
          lastStatus: attempt.status,
          lastError: attempt.error,
        })
        .where(eq(webhookSubscription.id, id));
    },

    recordDelivery: async ({ subscriptionId, eventId, event, body }, attempt) => {
      const at = new Date();

      await db
        .insert(webhookDelivery)
        .values({
          id: randomUUID(),
          subscriptionId,
          eventId,
          event,
          body,
          attempts: 1,
          firstAttemptAt: at,
          lastAttemptAt: at,
          ok: attempt.ok,
          status: attempt.status,
          error: attempt.error,
        })
        .onConflictDoUpdate({
          target: [webhookDelivery.subscriptionId, webhookDelivery.eventId],
          set: {
            attempts: sql`${webhookDelivery.attempts} + 1`,
            lastAttemptAt: at,
            ok: attempt.ok,
            status: attempt.status,
            error: attempt.error,
          },
        });
    },

    listDeliveries: async (subscriptionId, limit) => {
      const rows = await db
        .select()
        .from(webhookDelivery)
        .where(eq(webhookDelivery.subscriptionId, subscriptionId))
        .orderBy(desc(webhookDelivery.lastAttemptAt))
        .limit(limit);

      return rows.flatMap((row) => {
        const event = WebhookEventSchema.safeParse(row.event);

        return event.success
          ? [
              {
                id: row.id,
                subscriptionId: row.subscriptionId,
                event: event.data,
                attempts: row.attempts,
                firstAttemptAt: row.firstAttemptAt.toISOString(),
                lastAttemptAt: row.lastAttemptAt.toISOString(),
                ok: row.ok,
                status: row.status,
                error: row.error,
              },
            ]
          : [];
      });
    },

    readDeliveryBody: async (subscriptionId, deliveryId) => {
      const rows = await db
        .select({ body: webhookDelivery.body })
        .from(webhookDelivery)
        .where(
          and(
            eq(webhookDelivery.id, deliveryId),
            eq(webhookDelivery.subscriptionId, subscriptionId),
          ),
        );

      return rows[0]?.body ?? null;
    },

    pruneDeliveries: async (before) => {
      const removed = await db
        .delete(webhookDelivery)
        .where(lt(webhookDelivery.lastAttemptAt, before))
        .returning({ id: webhookDelivery.id });

      return removed.length;
    },
  };
};

export { createDatabaseWebhookStore, WEBHOOK_SECRET_PREFIX };
