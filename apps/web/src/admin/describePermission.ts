import type { Permission } from '@FluxContracts/schemas/Permission';

/**
 * What each permission is called on screen.
 *
 * Written out rather than derived from the identifier, because
 * "jobs.runDestructive" uncamel-cased is "run destructive", which says nothing
 * about what is destroyed. The point of this screen is somebody deciding what
 * to hand out, and that decision is made from the sentence, not the key.
 */
const LABELS: Record<Permission, string> = {
  administrator: 'Everything, including anything added later',

  'library.create': 'Add a library',
  'library.edit': 'Change a library’s settings',
  'library.delete': 'Delete a library',

  'jobs.run': 'Run a job',
  'jobs.schedule': 'Change when jobs run',
  'jobs.runDestructive': 'Run reset and rebuild',

  'media.rescan': 'Rescan one item',
  'media.delete': 'Delete media from disk',
  'media.override': 'Correct metadata',
  'media.artwork': 'Change artwork',
  'media.hide': 'Hide an item from everybody',

  'sharing.link': 'Create share links',
  'sharing.party': 'Start watch parties',

  'streaming.view': 'See who is watching',
  'streaming.stop': 'Stop somebody’s stream',
  'streaming.pause': 'Pause somebody’s stream',

  'download.media': 'Download media',

  'account.invite': 'Invite somebody',
  'account.manage': 'Manage accounts',
  'account.ban': 'Ban an account',
  'account.roles': 'Manage roles',
  'account.profiles': 'Manage other people’s profiles',

  'server.settings': 'Change server settings',
  'server.backup': 'Back the server up',
  'server.logs': 'Read the logs',
  'server.monitor': 'See what the server is doing',
};

/**
 * A permission in words.
 *
 * @param permission The permission as the server names it.
 */
const describePermission = (permission: Permission): string => LABELS[permission];

export { describePermission };
