import { Icon } from '@ValenceUI/Icon';
import {
  Add01Icon,
  Alert02Icon,
  Delete02Icon,
  MoreHorizontalIcon,
  PencilEdit01Icon,
} from '@hugeicons/core-free-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionMenu } from '@ValenceUI/ActionMenu';
import { Badge } from '@ValenceUI/Badge';
import { ConfirmDialog } from '@ValenceUI/ConfirmDialog';
import { DialogCompanion } from '@ValenceUI/DialogCompanion';
import { FormField } from '@ValenceUI/FormField';
import { DialogContent } from '@ValenceUI/DialogContent';
import { DialogFooter } from '@ValenceUI/DialogFooter';
import { DialogTitle } from '@ValenceUI/DialogTitle';
import { DataTable } from '@ValenceUI/DataTable';
import { Button } from '@ValenceUI/Button';
import { Checkbox } from '@ValenceUI/Checkbox';
import { TextField } from '@ValenceUI/TextField';
import { describePermission } from '@ValenceClient/admin/describePermission';
import { groupPermissions } from '@ValenceClient/admin/groupPermissions';
import { createRole, deleteRole, updateRole } from '@ValenceClient/admin/fetchRoles';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CouldNotRead } from '@ValenceUI/CouldNotRead';
import { adminQueries } from '@ValenceClient/query/adminQueries';
import type { DataTableColumn } from '@ValenceUI/DataTable.types';
import type { Refusal } from '@ValenceClient/admin/fetchRoles';
import type { Permission, Role } from '@ValenceContracts/schemas/Permission';
import { PanelCard } from '@ValenceScreens/components/PanelCard/PanelCard';

const NEW_ROLE_POSITION = 50;

/**
 * The roles on this server, what each grants and who holds them, with the making and changing of
 * them. Permissions are offered grouped by what they are about rather than as one long list, since
 * choosing from a hundred flat checkboxes is how a role ends up granting something nobody meant.
 */
const RolesPanel = () => {
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newRolePosition, setNewRolePosition] = useState(NEW_ROLE_POSITION.toString());
  const [newRolePermissions, setNewRolePermissions] = useState<Permission[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [refusal, setRefusal] = useState<Refusal>(null);
  const [draftName, setDraftName] = useState('');
  const [draftPosition, setDraftPosition] = useState('');

  const cache = useQueryClient();

  const askedRoles = useQuery(adminQueries.roles());
  const askedCatalogue = useQuery(adminQueries.permissions());

  const roles = askedRoles.data ?? [];
  const catalogue = askedCatalogue.data ?? [];
  const couldNotRead = askedRoles.isError || askedCatalogue.isError;

  const reload = useCallback(
    async () => cache.invalidateQueries({ queryKey: adminQueries.roles().queryKey }),
    [cache],
  );

  useEffect(() => {
    const picked = roles.find((candidate) => candidate.id === selectedRoleId) ?? null;

    setDraftName(picked?.name ?? '');
    setDraftPosition(picked === null ? '' : picked.position.toString());
  }, [selectedRoleId, roles]);

  const act = useCallback(
    async (run: () => Promise<Refusal>) => {
      const outcome = await run();

      setRefusal(outcome);

      if (outcome === null) {
        await reload();
      }
    },
    [reload],
  );

  const selected = roles.find((role) => role.id === selectedRoleId) ?? null;

  const togglePermission = async (role: Role, permission: Permission) => {
    const next = role.permissions.includes(permission)
      ? role.permissions.filter((held_) => held_ !== permission)
      : [...role.permissions, permission];

    await act(() => updateRole(role.id, { permissions: next }));
  };

  const live = useRef({
    onEdit: (id: string) => {
      setSelectedRoleId(id);
      setRefusal(null);
    },
    onAskDelete: (role: Role) => {
      setDeleting(role);
    },
  });

  const columns = useMemo<DataTableColumn<Role>[]>(
    () => [
      {
        id: 'name',
        header: 'Role',
        accessorFn: (role) => role.name,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-text">{row.original.name}</span>
            <span className="truncate text-xs text-text-muted">
              {row.original.permissions.includes('administrator')
                ? 'Everything'
                : row.original.permissions.length === 1
                  ? '1 permission'
                  : `${row.original.permissions.length.toString()} permissions`}
            </span>
          </span>
        ),
      },
      {
        id: 'position',
        header: 'Rank',
        accessorFn: (role) => role.position,
        cell: ({ row }) => <Badge size="sm">{row.original.position.toString()}</Badge>,
      },
      {
        id: 'act',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex justify-end">
            <ActionMenu
              label={`Actions for ${row.original.name}`}
              trigger={<Icon of={MoreHorizontalIcon} size={16} />}
              groups={[
                {
                  items: [
                    {
                      id: 'edit',
                      label: 'Edit role',
                      icon: <Icon of={PencilEdit01Icon} size={15} />,
                      onChoose: () => {
                        live.current.onEdit(row.original.id);
                      },
                    },
                  ],
                },
                {
                  items: [
                    {
                      id: 'delete',
                      label: 'Delete role',
                      icon: <Icon of={Delete02Icon} size={15} />,
                      isDestructive: true,
                      onChoose: () => {
                        live.current.onAskDelete(row.original);
                      },
                    },
                  ],
                },
              ]}
            />
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      {refusal === null || selected !== null ? null : (
        <p
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-text"
        >
          <Icon of={Alert02Icon} size={18} className="mt-0.5 shrink-0 text-danger" />
          {refusal.message}
        </p>
      )}

      <PanelCard
        title="Roles"
        isFlush
        actions={
          <Button
            variant="ghost"
            size="xs"
            className="shrink-0 text-xs text-text-muted hover:text-text"
            onClick={() => {
              setIsCreating(true);
            }}
          >
            <Icon of={Add01Icon} size={14} />
            Create role
          </Button>
        }
      >
        {couldNotRead ? (
          <CouldNotRead
            what="The roles"
            isTryingAgain={askedRoles.isFetching || askedCatalogue.isFetching}
            onTryAgain={() => {
              void askedRoles.refetch();
              void askedCatalogue.refetch();
            }}
          />
        ) : (
          <DataTable label="Roles" columns={columns} rows={roles} emptyMessage="No roles yet." />
        )}
      </PanelCard>

      <DialogCompanion
        label="Create a role"
        isOpen={isCreating}
        onClose={() => {
          setIsCreating(false);
        }}
      >
        <DialogTitle
          size="compact"
          title="Create a role"
          detail="A role is a name and a set of permissions. Rank decides who may manage whom."
        />

        <DialogContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end gap-3">
            <TextField
              label="Name"
              value={newRoleName}
              onValueChange={setNewRoleName}
              placeholder="Housemate"
              className="min-w-48 flex-1"
            />

            <TextField
              label="Rank"
              type="number"
              min={0}
              value={newRolePosition}
              onValueChange={setNewRolePosition}
              className="w-24 shrink-0"
            />
          </div>

          {groupPermissions(catalogue).map((group) => (
            <FormField key={group.id} label={group.label}>
              <ul className="flex flex-col">
                {group.permissions.map((permission) => (
                  <li key={permission} className="flex items-center gap-3 rounded-md py-1.5">
                    <Checkbox
                      label={describePermission(permission)}
                      checked={newRolePermissions.includes(permission)}
                      onCheckedChange={() => {
                        setNewRolePermissions((held) =>
                          held.includes(permission)
                            ? held.filter((candidate) => candidate !== permission)
                            : [...held, permission],
                        );
                      }}
                      className="min-w-0"
                    />

                    <span className="min-w-0 truncate font-mono text-xs text-text-muted/70">
                      {permission}
                    </span>
                  </li>
                ))}
              </ul>
            </FormField>
          ))}
        </DialogContent>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setIsCreating(false);
            }}
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            disabled={newRoleName === ''}
            onClick={() => {
              const position = Number.parseInt(newRolePosition, 10);

              void act(() =>
                createRole({
                  name: newRoleName,
                  position: Number.isNaN(position) ? NEW_ROLE_POSITION : position,
                  permissions: newRolePermissions,
                }),
              ).then(() => {
                setNewRoleName('');
                setNewRolePosition(NEW_ROLE_POSITION.toString());
                setNewRolePermissions([]);
                setIsCreating(false);
              });
            }}
          >
            Create role
          </Button>
        </DialogFooter>
      </DialogCompanion>

      <ConfirmDialog
        title="Delete this role?"
        detail={
          deleting === null
            ? ''
            : `${deleting.name} will be removed, and anybody holding it loses what it granted. This cannot be undone.`
        }
        confirmLabel="Delete role"
        isDestructive
        isOpen={deleting !== null}
        onClose={() => {
          setDeleting(null);
        }}
        onConfirm={() => {
          const role = deleting;

          setDeleting(null);

          if (role !== null) {
            void act(() => deleteRole(role.id));
          }
        }}
      />

      <DialogCompanion
        label={selected === null ? 'Edit role' : `Edit ${selected.name}`}
        isOpen={selected !== null}
        onClose={() => {
          setSelectedRoleId(null);
        }}
      >
        {selected === null ? null : (
          <>
            <DialogTitle
              size="compact"
              title={`Edit ${selected.name}`}
              detail="A higher rank manages a lower one. Nobody may touch a role at or above their own."
            />

            <DialogContent className="flex flex-col gap-5">
              {refusal === null ? null : (
                <p
                  role="alert"
                  className="flex items-start gap-3 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-text"
                >
                  <Icon of={Alert02Icon} size={16} className="mt-0.5 shrink-0 text-danger" />
                  {refusal.message}
                </p>
              )}

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
                  className="w-24 shrink-0"
                />
              </div>

              {groupPermissions(catalogue).map((group) => (
                <FormField key={group.id} label={group.label}>
                  <ul className="flex flex-col">
                    {group.permissions.map((permission) => (
                      <li key={permission} className="flex items-center gap-3 rounded-md py-1.5">
                        <Checkbox
                          label={describePermission(permission)}
                          checked={selected.permissions.includes(permission)}
                          onCheckedChange={() => {
                            void togglePermission(selected, permission);
                          }}
                          className="min-w-0"
                        />

                        <span className="min-w-0 truncate font-mono text-xs text-text-muted/70">
                          {permission}
                        </span>
                      </li>
                    ))}
                  </ul>
                </FormField>
              ))}
            </DialogContent>

            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedRoleId(null);
                }}
              >
                Close
              </Button>

              <Button
                variant="primary"
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
                Save changes
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogCompanion>
    </div>
  );
};

RolesPanel.displayName = 'RolesPanel';

export { RolesPanel };
