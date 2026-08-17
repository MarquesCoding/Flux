import { z } from 'zod';

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
  'streaming.message',

  'download.media',

  'account.keys',

  'account.invite',
  'account.manage',
  'account.ban',
  'account.roles',
  'account.profiles',

  'server.settings',
  'server.backup',
  'server.logs',
  'server.monitor',
  'server.webhooks',
] as const;

const PermissionSchema = z.enum(PERMISSIONS);

const ADMINISTRATOR: Permission = 'administrator';

const PermissionGrantSchema = z.object({
  permission: PermissionSchema,
  effect: z.enum(['allow', 'deny']),
});

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
