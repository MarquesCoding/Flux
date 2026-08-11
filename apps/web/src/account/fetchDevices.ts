import { z } from 'zod'

const DeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  signedInAt: z.string(),
  expiresAt: z.string(),
  isCurrent: z.boolean(),
})

const DeviceListSchema = z.object({ devices: z.array(DeviceSchema) })

type Device = z.infer<typeof DeviceSchema>

/**
 * Everywhere this account is signed in.
 *
 * Answers with nothing rather than throwing, like every other read a page
 * makes: a list of devices is something to check, and its absence must not
 * take the account page down with it.
 */
const fetchDevices = async (): Promise<Device[]> => {
  try {
    const response = await fetch('/api/account/devices', {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    })

    if (!response.ok) {
      return []
    }

    return DeviceListSchema.parse(await response.json()).devices
  } catch {
    return []
  }
}

/**
 * Signs one of them out.
 */
const endDevice = async (deviceId: string): Promise<boolean> => {
  const response = await fetch(`/api/account/devices/${deviceId}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null)

  return response !== null && response.ok
}

/**
 * Signs out everywhere but here.
 */
const endOtherDevices = async (): Promise<boolean> => {
  const response = await fetch('/api/account/devices/end-others', {
    method: 'POST',
    credentials: 'same-origin',
  }).catch(() => null)

  return response !== null && response.ok
}

export type { Device }

export default { fetchDevices, endDevice, endOtherDevices }
