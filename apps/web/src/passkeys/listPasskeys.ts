import { PasskeyListSchema } from '@FluxContracts/schemas/Passkey';
import type { Passkey } from '@FluxContracts/schemas/Passkey';

/**
 * Lists the passkeys registered to the signed-in user.
 */
const listPasskeys = async (): Promise<Passkey[]> => {
  const response = await fetch('/api/auth/passkey/list-user-passkeys', {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Passkey list failed with status ${response.status.toString()}`);
  }

  return PasskeyListSchema.parse(await response.json());
};

/**
 * Removes a registered passkey, for somebody who has lost the device it lived on.
 *
 * @param id - The passkey to remove.
 */
const deletePasskey = async (id: string): Promise<boolean> => {
  const response = await fetch('/api/auth/passkey/delete-passkey', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id }),
  });

  return response.ok;
};

/**
 * Renames a registered passkey, since a list of them is unusable when each is called the same thing.
 *
 * @param id - The passkey to rename.
 * @param name - What to call it.
 */
const renamePasskey = async (id: string, name: string): Promise<boolean> => {
  const response = await fetch('/api/auth/passkey/update-passkey', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, name }),
  });

  return response.ok;
};

export { listPasskeys, deletePasskey, renamePasskey };
