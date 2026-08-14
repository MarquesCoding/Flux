import type { Permission } from '@FluxContracts/schemas/Permission';

type DefaultRole = {
  name: string;
  /**
   * Where the role sits against the others. Higher manages lower, and nobody
   * manages their own rank or above.
   */
  position: number;
  description: string;
  permissions: readonly Permission[];
};

/**
 * The roles a fresh instance ships with.
 *
 * Granularity underneath is what the operator who wants it reaches for;
 * these four are what everybody else lives with. A permission system with
 * thirty switches and no sensible presets is one nobody configures correctly,
 * and the household ends up with everybody an administrator.
 *
 * The defaults are **permissive**, because the people on a Flux instance are
 * somebody's friends and family rather than an anonymous public. A household
 * of four adults should not have to configure anything to use their own
 * server; the parent and the operator with a wider circle get the controls
 * when they go looking for them.
 *
 * `Member` is what a new account gets, and it is deliberately not empty:
 * sharing a film with a friend and taking one on a plane are ordinary uses of
 * a household media server, not privileges to be earned.
 */
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
      'streaming.message',
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

/**
 * The role a new account is given.
 */
const DEFAULT_ROLE_NAME = 'Member';

export { DEFAULT_ROLES, DEFAULT_ROLE_NAME };
export type { DefaultRole };
