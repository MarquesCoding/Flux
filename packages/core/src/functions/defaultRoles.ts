import type { Permission } from '@FluxContracts/schemas/Permission';

type DefaultRole = {
  name: string;
  position: number;
  description: string;
  permissions: readonly Permission[];
};

const DEFAULT_ROLES: readonly DefaultRole[] = [
  {
    name: 'Administrator',
    position: 300,
    description: 'Runs the server. Everything, including anything added later.',
    permissions: ['administrator'],
  },
  {
    name: 'Manager',
    position: 200,
    description: 'Looks after the libraries and what is in them, but not the server itself.',
    permissions: [
      'library.create',
      'library.edit',
      'jobs.run',
      'jobs.schedule',
      'media.rescan',
      'media.override',
      'media.artwork',
      'media.hide',
      'streaming.view',
      'streaming.stop',
      'streaming.pause',
      'sharing.link',
      'sharing.party',
      'download.media',
      'account.keys',
      'server.logs',
      'server.monitor',
    ],
  },
  {
    name: 'Member',
    position: 100,
    description: 'Watches, shares and downloads. What everybody in the house gets.',
    permissions: ['sharing.link', 'sharing.party', 'download.media', 'account.keys'],
  },
  {
    name: 'Restricted',
    position: 0,
    description: 'Watches, and nothing else. For an account somebody wants kept narrow.',
    permissions: [],
  },
];

const DEFAULT_ROLE_NAME = 'Member';

export { DEFAULT_ROLES, DEFAULT_ROLE_NAME };
export type { DefaultRole };
