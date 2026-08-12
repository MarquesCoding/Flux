import { useCallback, useEffect, useState } from 'react';
import { IconAlertTriangle, IconPlus, IconTrash } from '@tabler/icons-react';
import { Badge } from '@FluxUI/Badge';
import { Button } from '@FluxUI/Button';
import { OptionMenu } from '@FluxUI/OptionMenu';
import { describePermission } from '@FluxWeb/admin/describePermission';
import { groupPermissions } from '@FluxWeb/admin/groupPermissions';
import {
  assignRole,
  clearOverride,
  fetchAccountPermissions,
  fetchPermissionCatalogue,
  fetchRoles,
  removeRole,
  setOverride,
} from '@FluxWeb/admin/fetchRoles';
import type { AccountPermissions, Refusal } from '@FluxWeb/admin/fetchRoles';
import type { Permission, Role } from '@FluxContracts/schemas/Permission';
import type { AccountsPanelProps } from './AccountsPanel.types';

/**
 * Who is on this server, and what each of them may do.
 *
 * Separate from the roles panel on purpose: that one answers "what does this
 * role mean", this one answers "what can this person do". They are the two
 * halves people actually come looking for, and putting both in one screen
 * meant editing a role and editing a person shared a page for no reason.
 *
 * Only roles and exceptions can be changed here today. Inviting, banning,
 * removing and editing an account all still go through better-auth's own
 * admin endpoints, which authorise against the column the permission model
 * replaced — see FLUX-75. Rather than reach for those from here and quietly
 * bypass the model, this panel does what Flux has routes for and no more.
 */
const AccountsPanel = ({ accounts }: AccountsPanelProps) => {
  const [catalogue, setCatalogue] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [held, setHeld] = useState<AccountPermissions | null>(null);
  const [refusal, setRefusal] = useState<Refusal>(null);
  const [addingPermission, setAddingPermission] = useState<Permission | null>(null);

  const reload = useCallback(async () => {
    if (accountId === null) {
      setHeld(null);

      return;
    }

    setHeld(await fetchAccountPermissions(accountId));
  }, [accountId]);

  useEffect(() => {
    void fetchPermissionCatalogue().then(setCatalogue);
    void fetchRoles().then(setRoles);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const act = async (run: () => Promise<Refusal>) => {
    const outcome = await run();

    setRefusal(outcome);

    if (outcome === null) {
      await reload();
    }
  };

  const picked = accounts.find((account) => account.id === accountId) ?? null;

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
          <h3 className="text-xs uppercase tracking-[0.16em] text-text-muted">Accounts</h3>

          <span className="text-xs text-text-muted">
            {accounts.length === 1 ? '1 account' : `${accounts.length.toString()} accounts`}
          </span>
        </header>

        {accounts.length === 0 ? (
          <p className="text-sm text-text-muted">Nobody has an account yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-white/5">
            {accounts.map((account) => (
              <li key={account.id} className="flex items-center gap-4 py-3 first:pt-0">
                <Button
                  variant="ghost"
                  className="h-auto min-w-0 flex-1 justify-start rounded-lg px-3 py-2 text-left"
                  aria-pressed={account.id === accountId}
                  onClick={() => {
                    setAccountId(account.id === accountId ? null : account.id);
                    setRefusal(null);
                  }}
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm text-text">{account.name}</span>
                    <span className="truncate text-xs text-text-muted">{account.email}</span>
                  </span>
                </Button>

                {account.role === null ? null : <Badge size="sm">{account.role}</Badge>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {picked === null || accountId === null ? null : (
        <section className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-surface/40 p-6">
          <header className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-xs uppercase tracking-[0.16em] text-text-muted">
              What {picked.name} may do
            </h3>

            {held === null ? null : (
              <span className="text-xs text-text-muted">
                {held.effective.length === 1
                  ? '1 permission in all'
                  : `${held.effective.length.toString()} permissions in all`}
              </span>
            )}
          </header>

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
                  <li key={grant.permission} className="flex items-center gap-3 rounded-lg py-1">
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
                      <IconTrash size={14} aria-hidden />
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
                trigger={
                  <Button variant="ghost" size="sm" isPill>
                    <IconPlus size={16} aria-hidden />
                    {addingPermission === null
                      ? 'Pick a permission'
                      : describePermission(addingPermission)}
                  </Button>
                }
                groups={groupPermissions(catalogue).map((group) => ({
                  name: group.label,
                  options: group.permissions.map((permission) => ({
                    id: permission,
                    label: describePermission(permission),
                    detail: permission,
                  })),
                  selectedId: addingPermission ?? '',
                  onSelect: (id) => {
                    setAddingPermission(catalogue.find((permission) => permission === id) ?? null);
                  },
                }))}
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

            <div className="flex flex-wrap gap-1.5">
              {(held?.effective ?? []).map((permission) => (
                <Badge key={permission} size="sm">
                  {permission}
                </Badge>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

AccountsPanel.displayName = 'AccountsPanel';

export { AccountsPanel };
