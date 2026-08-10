import PasskeyModule from '@FluxContracts/schemas/Passkey'
import type { Passkey } from '@FluxContracts/schemas/Passkey'

const { PasskeyListSchema } = PasskeyModule

/**
 * Lists the passkeys registered to the signed-in user.
 */
const listPasskeys = async (): Promise<Passkey[]> => {
  const response = await fetch('/api/auth/passkey/list-user-passkeys', {
    headers: { accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Passkey list failed with status ${response.status.toString()}`)
  }

  return PasskeyListSchema.parse(await response.json())
}

/**
 * Removes a registered passkey.
 */
const deletePasskey = async (id: string): Promise<boolean> => {
  const response = await fetch('/api/auth/passkey/delete-passkey', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id }),
  })

  return response.ok
}

export default { listPasskeys, deletePasskey }
