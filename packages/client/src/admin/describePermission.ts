import type { Permission } from '@FluxContracts/schemas/Permission';

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
  'sharing.manage': 'See and withdraw anybody’s share links',

  'streaming.view': 'See who is watching',
  'streaming.stop': 'Stop somebody’s stream',
  'streaming.pause': 'Pause somebody’s stream',
  'streaming.message': 'Send somebody a message',

  'download.media': 'Download media',

  'account.invite': 'Invite somebody',
  'account.manage': 'Manage accounts',
  'account.ban': 'Ban an account',
  'account.roles': 'Manage roles',
  'account.profiles': 'Manage other people’s profiles',

  'server.settings': 'Change server settings',
  'server.backup': 'Back the server up',
  'server.logs': 'Read the logs',
  'account.keys': 'Hold API keys for use outside the browser',
  'server.monitor': 'See what the server is doing',
  'server.webhooks': 'Have the server call out when something happens',
};

/**
 * Names a permission in words rather than in the identifier it is stored as, so that a role editor
 * reads as sentences about what somebody may do.
 *
 * @param permission The permission as the server names it.
 */
const describePermission = (permission: Permission): string => LABELS[permission];

export { describePermission };
