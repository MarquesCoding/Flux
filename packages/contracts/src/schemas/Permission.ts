import { z } from 'zod';

/**
 * Every capability an account can be granted, as a tuple.
 *
 * Exported separately so route definitions can build their own schema with
 * the OpenAPI-extended `z` while still deriving the values from one place.
 * Mixing zod instances between packages breaks request type inference.
 *
 * Grouped by the thing they act on, because a flat list of thirty is not
 * something anybody configures correctly. The grouping is the prefix, so a
 * UI can derive its sections rather than keeping its own copy of them.
 *
 * These are capabilities — what an account may *do*. What an account may
 * *see* is a separate axis and is deliberately not in this list: access to a
 * particular library is scoped to that library, and a scoped permission
 * flattened into a global set reads as "may view libraries", which is not a
 * question anybody meant to ask. Content access is resolved against the
 * library in hand, alongside the rating ceilings in FLUX-60.
 */
const PERMISSIONS = [
  'administrator',

  'library.create',
  'library.edit',
  'library.delete',

  'jobs.run',
  'jobs.schedule',
  'jobs.runDestructive',

  'media.rescan',
  'media.delete',
  'media.override',
  'media.artwork',
  'media.hide',

  'sharing.link',
  'sharing.party',

  'streaming.view',
  'streaming.stop',
  'streaming.pause',

  'download.media',

  'account.invite',
  'account.manage',
  'account.ban',
  'account.roles',
  'account.profiles',

  'server.settings',
  'server.backup',
  'server.logs',
] as const;

const PermissionSchema = z.enum(PERMISSIONS);

/**
 * The permission that implies every other one.
 *
 * A single condition rather than a list that has to be kept in step with the
 * catalogue: every permission added after this is one somebody would
 * otherwise have to remember to grant the people already running the server.
 */
const ADMINISTRATOR: Permission = 'administrator';

/**
 * Whether an account may be told to give a permission up.
 *
 * Only `administrator` is protected, and only for the last account holding
 * it. Everything else is the operator's business.
 */
const PermissionGrantSchema = z.object({
  permission: PermissionSchema,
  effect: z.enum(['allow', 'deny']),
});

/**
 * A named set of permissions the operator defined.
 *
 * `position` orders roles against each other, and the order is what makes
 * managing them safe: without it, "may manage roles" quietly means "may make
 * myself an administrator".
 */
const RoleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(60),
  position: z.number().int().nonnegative(),
  permissions: z.array(PermissionSchema),
});

type Permission = (typeof PERMISSIONS)[number];
type PermissionGrant = z.infer<typeof PermissionGrantSchema>;
type Role = z.infer<typeof RoleSchema>;

export { PERMISSIONS, PermissionSchema, PermissionGrantSchema, RoleSchema, ADMINISTRATOR };

export type { Permission, PermissionGrant, Role };
