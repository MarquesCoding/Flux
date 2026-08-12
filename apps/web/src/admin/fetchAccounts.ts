import { z } from 'zod';
import type { Refusal } from './fetchRoles';

const AccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  createdAt: z.string(),
  isBanned: z.boolean(),
  banReason: z.string().nullable(),
  position: z.number().nullable(),
  isAdministrator: z.boolean(),
});

type Account = z.infer<typeof AccountSchema>;

const readRefusal = async (response: Response): Promise<Refusal> => {
  if (response.ok) {
    return null;
  }

  const body = await response
    .json()
    .then((value) => z.object({ error: z.string() }).safeParse(value))
    .catch(() => null);

  return {
    message:
      body?.success === true ? body.data.error : 'That could not be done. Try again in a moment.',
  };
};

/**
 * Everybody with an account, as the administration page needs them.
 *
 * Read from Flux's own route rather than from the overview, because this one
 * answers what each account resolves to — whether it is an administrator by
 * its permissions, and what rank it holds — which is what decides whether the
 * person looking may act on it.
 */
const fetchAccounts = async (): Promise<Account[]> => {
  const response = await fetch('/api/admin/accounts', { credentials: 'same-origin' }).catch(
    () => null,
  );

  if (response === null || !response.ok) {
    return [];
  }

  return z.object({ accounts: z.array(AccountSchema) }).parse(await response.json()).accounts;
};

const banAccount = async (userId: string, reason: string): Promise<Refusal> => {
  const response = await fetch(`/api/admin/accounts/${userId}/ban`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason }),
  }).catch(() => null);

  return response === null
    ? { message: 'The server could not be reached.' }
    : readRefusal(response);
};

const unbanAccount = async (userId: string): Promise<Refusal> => {
  const response = await fetch(`/api/admin/accounts/${userId}/ban`, {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null);

  return response === null
    ? { message: 'The server could not be reached.' }
    : readRefusal(response);
};

const removeAccount = async (userId: string): Promise<Refusal> => {
  const response = await fetch(`/api/admin/accounts/${userId}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null);

  return response === null
    ? { message: 'The server could not be reached.' }
    : readRefusal(response);
};

export { fetchAccounts, banAccount, unbanAccount, removeAccount };
export type { Account };
