import { readFromServer } from '@ValenceClient/query/readFromServer';
import { readRefusal } from './readRefusal';
import type { Refusal } from './readRefusal';
import { z } from 'zod';

const AccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  createdAt: z.string(),
  isBanned: z.boolean(),
  banReason: z.string().nullable(),
  position: z.number().nullable(),
  isAdministrator: z.boolean(),
  roles: z.array(z.string()),
});

type Account = z.infer<typeof AccountSchema>;

/**
 * Everybody with an account on this server, with what each may do and whether they are banned. What
 * the administration page needs to show them all in one table.
 */
const fetchAccounts = async (): Promise<Account[]> => {
  return (
    await readFromServer('/api/admin/accounts', z.object({ accounts: z.array(AccountSchema) }))
  ).accounts;
};

/**
 * Bans an account, with a reason the person is shown when they next try to sign in. Their sessions
 * end; nothing they have watched or kept is touched.
 *
 * @param userId - The account to ban.
 * @param reason - What they are told.
 * @returns Any refusal from the server.
 */
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

/**
 * Lifts a ban, letting the account sign in again with everything it had before.
 *
 * @param userId - The account to unban.
 * @returns Any refusal from the server.
 */
const unbanAccount = async (userId: string): Promise<Refusal> => {
  const response = await fetch(`/api/admin/accounts/${userId}/ban`, {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null);

  return response === null
    ? { message: 'The server could not be reached.' }
    : readRefusal(response);
};

/**
 * Removes an account and everything hanging off it — its profiles, their history and their progress.
 * A ban is the reversible version of this; removal is not.
 *
 * @param userId - The account to remove.
 * @returns Any refusal from the server.
 */
const removeAccount = async (userId: string): Promise<Refusal> => {
  const response = await fetch(`/api/admin/accounts/${userId}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null);

  return response === null
    ? { message: 'The server could not be reached.' }
    : readRefusal(response);
};

/**
 * Invites somebody to this server, creating their account and the means for them to set a password.
 *
 * @param request - Who is being invited and what they may do.
 * @returns The account, or why it was refused.
 */
const inviteAccount = async (request: {
  name: string;
  email: string;
  password: string;
}): Promise<Refusal> => {
  const response = await fetch('/api/admin/accounts', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  }).catch(() => null);

  return response === null
    ? { message: 'The server could not be reached.' }
    : readRefusal(response);
};

export { fetchAccounts, banAccount, unbanAccount, removeAccount, inviteAccount };
export type { Account };
