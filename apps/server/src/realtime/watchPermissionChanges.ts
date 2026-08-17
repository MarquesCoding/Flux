import type { PermissionService } from '@FluxServer/auth/PermissionService';

type PermissionWatcher = {
  accountChanged: (userId: string) => void;
  everyoneChanged: () => void;
};

/**
 * Wraps the permission service so that every change to who may do what reaches connections already
 * open, rather than only the next request.
 *
 * Done here rather than at each route that edits a role, because there are eight such routes and
 * missing one leaves a socket delivering an admin feed to somebody whose permission was taken away.
 * Wrapping the thing being changed cannot be forgotten; remembering to announce at each call site
 * can.
 *
 * Editing or deleting a role affects everybody holding it rather than one account, so those announce
 * to everyone. Assigning, removing and overriding name the account they touch.
 *
 * @param service - The service being wrapped.
 * @param watcher - Told who has been affected.
 * @returns A service that behaves the same and announces what it changed.
 */
const watchPermissionChanges = (
  service: PermissionService,
  watcher: PermissionWatcher,
): PermissionService => ({
  ...service,

  updateRole: async (id, role) => {
    const updated = await service.updateRole(id, role);

    watcher.everyoneChanged();

    return updated;
  },

  deleteRole: async (id) => {
    const deleted = await service.deleteRole(id);

    watcher.everyoneChanged();

    return deleted;
  },

  assignRole: async (userId, roleId) => {
    await service.assignRole(userId, roleId);

    watcher.accountChanged(userId);
  },

  removeRole: async (userId, roleId) => {
    await service.removeRole(userId, roleId);

    watcher.accountChanged(userId);
  },

  setOverride: async (userId, grant) => {
    await service.setOverride(userId, grant);

    watcher.accountChanged(userId);
  },

  clearOverride: async (userId, permission) => {
    await service.clearOverride(userId, permission);

    watcher.accountChanged(userId);
  },
});

export type { PermissionWatcher };

export { watchPermissionChanges };
