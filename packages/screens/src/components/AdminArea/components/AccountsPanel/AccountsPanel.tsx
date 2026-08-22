import { Icon } from '@FluxUI/Icon';
import {
  CaretUpDownIcon,
  DotsThreeIcon,
  PlusIcon,
  TrashIcon,
  UserGearIcon,
  WarningIcon,
  XCircleIcon,
} from '@phosphor-icons/react';
import { useCallback, useMemo, useState } from 'react';
import { ActionMenu } from '@FluxUI/ActionMenu';
import { Badge } from '@FluxUI/Badge';
import { CardHeader } from '@FluxUI/CardHeader';
import { DataTable } from '@FluxUI/DataTable';
import { Button } from '@FluxUI/Button';
import { Card } from '@FluxUI/Card';
import { ConfirmDialog } from '@FluxUI/ConfirmDialog';
import { Dialog } from '@FluxUI/Dialog';
import { DialogContent } from '@FluxUI/DialogContent';
import { DialogFooter } from '@FluxUI/DialogFooter';
import { DialogTitle } from '@FluxUI/DialogTitle';
import { OptionMenu } from '@FluxUI/OptionMenu';
import { TextField } from '@FluxUI/TextField';
import { describePermission } from '@FluxClient/admin/describePermission';
import { groupPermissions } from '@FluxClient/admin/groupPermissions';
import { assignRole, clearOverride, removeRole, setOverride } from '@FluxClient/admin/fetchRoles';
import {
  banAccount,
  inviteAccount,
  removeAccount,
  unbanAccount,
} from '@FluxClient/admin/fetchAccounts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CouldNotRead } from '@FluxUI/CouldNotRead';
import { adminQueries } from '@FluxClient/query/adminQueries';
import type { DataTableColumn } from '@FluxUI/DataTable.types';
import type { Account } from '@FluxClient/admin/fetchAccounts';
import type { Refusal } from '@FluxClient/admin/fetchRoles';
import type { Permission } from '@FluxContracts/schemas/Permission';

type Asked = { kind: 'ban' | 'remove'; account: Account };

/**
 * Who is on this server and what each of them may do: their roles, the permissions set against them
 * directly, and the ways an administrator can ban, unban or remove them. Permissions set against one
 * person are shown beside their roles rather than hidden behind them, since that is where a
 * surprising answer usually comes from.
 */
const AccountsPanel = () => {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<Refusal>(null);
  const [addingPermission, setAddingPermission] = useState<Permission | null>(null);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [search, setSearch] = useState('');
  const [asking, setAsking] = useState<Asked | null>(null);

  const cache = useQueryClient();

  const askedAccounts = useQuery(adminQueries.accounts());
  const askedCatalogue = useQuery(adminQueries.permissions());
  const askedRoles = useQuery(adminQueries.roles());

  const accounts = askedAccounts.data ?? [];
  const catalogue = askedCatalogue.data ?? [];
  const roles = askedRoles.data ?? [];
  const held = useQuery(adminQueries.accountPermissions(accountId)).data ?? null;

  const reload = useCallback(async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: adminQueries.accounts().queryKey }),
      cache.invalidateQueries({ queryKey: adminQueries.accountPermissions(accountId).queryKey }),
    ]);
  }, [cache, accountId]);

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

  const picked = accounts.find((account) => account.id === accountId) ?? null;

  const shown = useMemo(() => {
    const looking = search.trim().toLowerCase();

    return accounts.filter(
      (account) =>
        account.name.toLowerCase().includes(looking) ||
        account.email.toLowerCase().includes(looking),
    );
  }, [accounts, search]);

  const columns = useMemo<DataTableColumn<Account>[]>(
    () => [
      {
        id: 'name',
        header: 'Account',
        accessorFn: (account) => account.name,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-text">{row.original.name}</span>
            <span className="truncate text-xs text-text-muted">
              {row.original.isBanned && row.original.banReason !== null
                ? `Banned — ${row.original.banReason}`
                : row.original.email}
            </span>
          </span>
        ),
      },
      {
        id: 'roles',
        header: 'Roles',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.roles.length === 0 ? (
            <span className="text-xs text-text-muted">No roles</span>
          ) : (
            <span className="flex flex-wrap items-center gap-1.5">
              {row.original.roles.map((role) => (
                <Badge
                  key={role}
                  size="sm"
                  tone={
                    row.original.isAdministrator && role === 'Administrator' ? 'accent' : 'quiet'
                  }
                >
                  {role}
                </Badge>
              ))}
            </span>
          ),
      },
      {
        id: 'state',
        header: 'State',
        accessorFn: (account) => (account.isBanned ? 'Banned' : 'Allowed'),
        cell: ({ row }) =>
          row.original.isBanned ? (
            <Badge size="sm" tone="solid">
              banned
            </Badge>
          ) : (
            <span className="text-xs text-text-muted">Allowed</span>
          ),
      },
      {
        id: 'act',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex justify-end">
            <ActionMenu
              label={`Actions for ${row.original.name}`}
              trigger={<Icon of={DotsThreeIcon} size={16} />}
              groups={[
                {
                  items: [
                    {
                      id: 'roles',
                      label: 'Edit roles',
                      icon: <Icon of={UserGearIcon} size={15} />,
                      onChoose: () => {
                        setAccountId(row.original.id);
                        setRefusal(null);
                      },
                    },
                    {
                      id: 'ban',
                      label: row.original.isBanned ? 'Let back in' : 'Ban',
                      icon: <Icon of={XCircleIcon} size={15} />,
                      onChoose: () => {
                        if (row.original.isBanned) {
                          void act(() => unbanAccount(row.original.id));

                          return;
                        }

                        setAsking({ kind: 'ban', account: row.original });
                      },
                    },
                  ],
                },
                {
                  items: [
                    {
                      id: 'remove',
                      label: 'Delete account',
                      icon: <Icon of={TrashIcon} size={15} />,
                      isDestructive: true,
                      onChoose: () => {
                        setAsking({ kind: 'remove', account: row.original });
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
    [act],
  );

  const confirm = () => {
    if (asking === null) {
      return;
    }

    const { kind, account } = asking;

    setAsking(null);

    void act(() =>
      kind === 'ban'
        ? banAccount(account.id, 'Banned from the admin area')
        : removeAccount(account.id),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <ConfirmDialog
        title={asking?.kind === 'remove' ? 'Delete this account?' : 'Ban this account?'}
        detail={
          asking === null
            ? ''
            : asking.kind === 'remove'
              ? `${asking.account.name} will be removed, along with everything they were watching. This cannot be undone.`
              : `${asking.account.name} will be signed out and refused entry until you let them back in.`
        }
        confirmLabel={asking?.kind === 'remove' ? 'Delete account' : 'Ban'}
        isDestructive
        isOpen={asking !== null}
        onClose={() => {
          setAsking(null);
        }}
        onConfirm={confirm}
      />

      <Dialog
        label="Add user"
        isOpen={isInviting}
        onClose={() => {
          setIsInviting(false);
        }}
        className="sm:w-[min(30rem,92vw)]"
      >
        <DialogTitle
          title="Add user"
          detail="They arrive able to watch and nothing more, until you give them a role."
        />

        <DialogContent className="flex flex-col gap-4">
          <TextField label="Name" value={inviteName} onValueChange={setInviteName} />

          <TextField
            label="Address"
            type="email"
            value={inviteEmail}
            onValueChange={setInviteEmail}
          />

          <TextField
            label="Password"
            type="password"
            value={invitePassword}
            onValueChange={setInvitePassword}
          />

          <p className="text-center font-body text-xs text-text-muted">
            Flux cannot send email, so tell them this password yourself.
          </p>
        </DialogContent>

        <DialogFooter>
          <Button
            variant="secondary"
            isPill
            onClick={() => {
              setIsInviting(false);
            }}
          >
            Cancel
          </Button>

          <Button
            variant="glossy"
            isPill
            disabled={inviteName === '' || inviteEmail === '' || invitePassword.length < 8}
            onClick={() => {
              void act(() =>
                inviteAccount({
                  name: inviteName,
                  email: inviteEmail,
                  password: invitePassword,
                }),
              ).then(() => {
                setInviteName('');
                setInviteEmail('');
                setInvitePassword('');
                setIsInviting(false);
              });
            }}
          >
            Add
          </Button>
        </DialogFooter>
      </Dialog>

      {refusal === null || picked !== null ? null : (
        <p
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-text"
        >
          <Icon of={WarningIcon} size={18} className="mt-0.5 shrink-0 text-danger" />
          {refusal.message}
        </p>
      )}

      <Card as="section" padding="none" className="flex flex-col">
        <CardHeader title="Accounts">
          <TextField
            label="Find somebody"
            isLabelHidden
            size="sm"
            isPill
            type="search"
            placeholder="Find somebody"
            value={search}
            onValueChange={setSearch}
            className="w-56 max-w-full"
          />

          <Button
            variant="glossy"
            size="sm"
            isPill
            onClick={() => {
              setIsInviting(true);
            }}
          >
            <Icon of={PlusIcon} size={15} />
            Add user
          </Button>
        </CardHeader>

        {askedAccounts.isError ? (
          <CouldNotRead
            what="The accounts"
            isTryingAgain={askedAccounts.isFetching}
            onTryAgain={() => {
              void askedAccounts.refetch();
              void askedCatalogue.refetch();
              void askedRoles.refetch();
            }}
          />
        ) : (
          <DataTable
            label="Accounts"
            columns={columns}
            rows={shown}
            pageSize={10}
            emptyMessage={
              accounts.length === 0 ? 'Nobody has an account yet.' : 'Nobody here matches that.'
            }
          />
        )}
      </Card>

      <Dialog
        label={picked === null ? 'Roles' : `What ${picked.name} may do`}
        isOpen={picked !== null && accountId !== null}
        onClose={() => {
          setAccountId(null);
          setRefusal(null);
        }}
      >
        {picked === null || accountId === null ? null : (
          <>
            <DialogTitle
              title={`What ${picked.name} may do`}
              {...(held === null
                ? {}
                : {
                    detail:
                      held.effective.length === 1
                        ? '1 permission in all'
                        : `${held.effective.length.toString()} permissions in all`,
                  })}
            />

            <DialogContent className="flex flex-col gap-5">
              {refusal === null ? null : (
                <p
                  role="alert"
                  className="flex items-start gap-3 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-text"
                >
                  <Icon of={WarningIcon} size={16} className="mt-0.5 shrink-0 text-danger" />
                  {refusal.message}
                </p>
              )}

              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-medium text-text">Roles</h4>

                <div className="flex flex-wrap gap-2">
                  {roles.map((role) => {
                    const has = (held?.roles ?? []).some((candidate) => candidate.id === role.id);

                    return (
                      <Button
                        key={role.id}
                        variant={has ? 'glossy' : 'ghost'}
                        size="sm"
                        isPill
                        aria-pressed={has}
                        onClick={() => {
                          void act(() =>
                            has ? removeRole(accountId, role.id) : assignRole(accountId, role.id),
                          );
                        }}
                      >
                        {role.name}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-medium text-text">Exceptions</h4>

                {(held?.overrides ?? []).length === 0 ? (
                  <p className="text-sm text-text-muted">None. Their roles decide everything.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {(held?.overrides ?? []).map((grant) => (
                      <li
                        key={grant.permission}
                        className="flex items-center gap-3 rounded-lg py-1"
                      >
                        <Badge size="sm" tone={grant.effect === 'deny' ? 'solid' : 'accent'}>
                          {grant.effect}
                        </Badge>

                        <span className="min-w-0 flex-1 truncate text-sm text-text">
                          {describePermission(grant.permission)}
                        </span>

                        <Button
                          variant="ghost"
                          size="sm"
                          isPill
                          aria-label={`Forget the ${grant.effect} on ${grant.permission}`}
                          onClick={() => {
                            void act(() => clearOverride(accountId, grant.permission));
                          }}
                        >
                          <Icon of={TrashIcon} size={14} />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <OptionMenu
                    label="Add an exception"
                    align="start"
                    matchTriggerWidth
                    className="min-w-56 flex-1"
                    trigger={
                      <span className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--surface-line)] bg-[var(--surface-hover)] px-3 py-2 text-sm text-text">
                        <span className="min-w-0 truncate">
                          {addingPermission === null
                            ? 'Pick a permission'
                            : describePermission(addingPermission)}
                        </span>
                        <Icon of={CaretUpDownIcon} size={16} className="shrink-0 text-text-muted" />
                      </span>
                    }
                    groups={[
                      {
                        name: 'Permissions',
                        options: groupPermissions(catalogue).flatMap((group) =>
                          group.permissions.map((permission) => ({
                            id: permission,
                            label: describePermission(permission),
                            detail: `${group.label} · ${permission}`,
                          })),
                        ),
                        selectedId: addingPermission ?? '',
                        onSelect: (id) => {
                          setAddingPermission(
                            catalogue.find((permission) => permission === id) ?? null,
                          );
                        },
                      },
                    ]}
                  />

                  <Button
                    variant="ghost"
                    size="sm"
                    isPill
                    disabled={addingPermission === null}
                    onClick={() => {
                      if (addingPermission !== null) {
                        void act(() =>
                          setOverride(accountId, { permission: addingPermission, effect: 'allow' }),
                        );
                      }
                    }}
                  >
                    Allow it
                  </Button>

                  <Button
                    variant="danger"
                    size="sm"
                    isPill
                    disabled={addingPermission === null}
                    onClick={() => {
                      if (addingPermission !== null) {
                        void act(() =>
                          setOverride(accountId, { permission: addingPermission, effect: 'deny' }),
                        );
                      }
                    }}
                  >
                    Deny it
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-medium text-text">Comes to</h4>

                {(held?.effective ?? []).includes('administrator') ? (
                  <p className="text-sm text-text-muted">
                    Everything, including anything added to Flux later.
                  </p>
                ) : (held?.effective ?? []).length === 0 ? (
                  <p className="text-sm text-text-muted">Nothing at all.</p>
                ) : (
                  <ul className="flex flex-wrap gap-x-4 gap-y-1">
                    {(held?.effective ?? []).map((permission) => (
                      <li key={permission} className="font-mono text-xs text-text-muted">
                        {permission}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </DialogContent>

            <DialogFooter>
              <Button
                variant="secondary"
                isPill
                onClick={() => {
                  setAccountId(null);
                  setRefusal(null);
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>
    </div>
  );
};

AccountsPanel.displayName = 'AccountsPanel';

export { AccountsPanel };
