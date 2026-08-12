import { useCallback, useEffect, useState } from 'react';
import { IconAlertTriangle, IconPlus, IconTrash } from '@tabler/icons-react';
import { Badge } from '@FluxUI/Badge';
import { Button } from '@FluxUI/Button';
import { Checkbox } from '@FluxUI/Checkbox';
import { TextField } from '@FluxUI/TextField';
import { describePermission } from '@FluxWeb/admin/describePermission';
import { groupPermissions } from '@FluxWeb/admin/groupPermissions';
import {
  createRole,
  deleteRole,
  fetchPermissionCatalogue,
  fetchRoles,
  updateRole,
} from '@FluxWeb/admin/fetchRoles';
import type { Refusal } from '@FluxWeb/admin/fetchRoles';
import type { Permission, Role } from '@FluxContracts/schemas/Permission';

/**
 * Where a new role sits until somebody moves it.
 *
 * Below Member, so a role made in a hurry cannot outrank the people already
 * using the server.
 */
const NEW_ROLE_POSITION = 50;

/**
 * Roles, what they grant, and who holds them.
 *
 * The catalogue is read from the server rather than listed here, so a
 * permission added to Flux appears on this screen without the web app being
 * changed — which is the whole reason `/api/admin/permissions` exists.
 *
 * Every refusal the server makes is shown as the sentence the server gave.
 * Being outranked, granting what you do not hold, and taking the last
 * administrator away are deliberate rules rather than failures, and reporting
 * them as "something went wrong" would make a careful system look broken.
 */
const RolesPanel = () => {
  const [catalogue, setCatalogue] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [refusal, setRefusal] = useState<Refusal>(null);
  const [draftName, setDraftName] = useState('');
  const [draftPosition, setDraftPosition] = useState('');

  const reload = useCallback(async () => {
    setRoles(await fetchRoles());
  }, []);

  useEffect(() => {
    void fetchPermissionCatalogue().then(setCatalogue);
    void reload();
  }, [reload]);

  useEffect(() => {
    const picked = roles.find((candidate) => candidate.id === selectedRoleId) ?? null;

    setDraftName(picked?.name ?? '');
    setDraftPosition(picked === null ? '' : picked.position.toString());
  }, [selectedRoleId, roles]);

  const act = async (run: () => Promise<Refusal>) => {
    const outcome = await run();

    setRefusal(outcome);

    if (outcome === null) {
      await reload();
    }
  };

  const selected = roles.find((role) => role.id === selectedRoleId) ?? null;

  const togglePermission = async (role: Role, permission: Permission) => {
    const next = role.permissions.includes(permission)
      ? role.permissions.filter((held_) => held_ !== permission)
      : [...role.permissions, permission];

    await act(() => updateRole(role.id, { permissions: next }));
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {refusal === null ? null : (
        <p
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-text"
        >
          <IconAlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" aria-hidden />
          {refusal.message}
        </p>
      )}

      <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-surface/40 p-6">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-xs uppercase tracking-[0.16em] text-text-muted">Roles</h3>

          <span className="text-xs text-text-muted">Highest first</span>
        </header>

        {roles.length === 0 ? (
          <p className="text-sm text-text-muted">No roles yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-white/5">
            {roles.map((role) => (
              <li key={role.id} className="flex items-center gap-4 py-3 first:pt-0">
                <Button
                  variant="ghost"
                  className="h-auto min-w-0 flex-1 justify-start rounded-lg px-3 py-2 text-left"
                  onClick={() => {
                    setSelectedRoleId(role.id === selectedRoleId ? null : role.id);
                    setRefusal(null);
                  }}
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm text-text">{role.name}</span>
                    <span className="text-xs text-text-muted">
                      {role.permissions.includes('administrator')
                        ? 'Everything'
                        : role.permissions.length === 1
                          ? '1 permission'
                          : `${role.permissions.length.toString()} permissions`}
                    </span>
                  </span>
                </Button>

                <Badge size="sm">{role.position.toString()}</Badge>

                <Button
                  variant="ghost"
                  size="sm"
                  isPill
                  aria-label={`Delete ${role.name}`}
                  onClick={() => {
                    void act(() => deleteRole(role.id));
                  }}
                >
                  <IconTrash size={16} aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <TextField
            label="New role"
            value={newRoleName}
            onValueChange={setNewRoleName}
            placeholder="Housemate"
            className="min-w-48 flex-1"
          />

          <Button
            variant="glossy"
            size="sm"
            isPill
            disabled={newRoleName === ''}
            onClick={() => {
              void act(() =>
                createRole({ name: newRoleName, position: NEW_ROLE_POSITION, permissions: [] }),
              ).then(() => {
                setNewRoleName('');
              });
            }}
          >
            <IconPlus size={16} aria-hidden />
            Create
          </Button>
        </div>
      </section>

      {selected === null ? null : (
        <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-surface/40 p-6">
          <header className="flex flex-col gap-4">
            <h3 className="text-xs uppercase tracking-[0.16em] text-text-muted">
              What {selected.name} grants
            </h3>

            <div className="flex flex-wrap items-end gap-3">
              <TextField
                label="Name"
                value={draftName}
                onValueChange={setDraftName}
                className="min-w-48 flex-1"
              />

              <TextField
                label="Rank"
                type="number"
                min={0}
                value={draftPosition}
                onValueChange={setDraftPosition}
                description="Higher manages lower"
                className="w-32"
              />

              <Button
                variant="ghost"
                size="sm"
                isPill
                disabled={
                  draftName === '' ||
                  (draftName === selected.name && draftPosition === selected.position.toString())
                }
                onClick={() => {
                  const position = Number.parseInt(draftPosition, 10);

                  void act(() =>
                    updateRole(selected.id, {
                      name: draftName,
                      ...(Number.isNaN(position) ? {} : { position }),
                    }),
                  );
                }}
              >
                Save
              </Button>
            </div>
          </header>

          {groupPermissions(catalogue).map((group) => (
            <div key={group.id} className="flex flex-col gap-2">
              <h4 className="text-xs font-medium text-text">{group.label}</h4>

              <ul className="flex flex-col">
                {group.permissions.map((permission) => (
                  <li key={permission} className="flex items-center gap-3 rounded-lg px-3 py-2">
                    <Checkbox
                      label={describePermission(permission)}
                      checked={selected.permissions.includes(permission)}
                      onCheckedChange={() => {
                        void togglePermission(selected, permission);
                      }}
                      className="min-w-0 flex-1"
                    />

                    <span className="shrink-0 font-mono text-xs text-text-muted">{permission}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};

RolesPanel.displayName = 'RolesPanel';

export { RolesPanel };
