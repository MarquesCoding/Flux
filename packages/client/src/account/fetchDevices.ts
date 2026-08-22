import { readFromServer } from '@ValenceClient/query/readFromServer';
import { z } from 'zod';

const DeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  signedInAt: z.string(),
  expiresAt: z.string(),
  isCurrent: z.boolean(),
});

const DeviceListSchema = z.object({ devices: z.array(DeviceSchema) });

type Device = z.infer<typeof DeviceSchema>;

/**
 * Everywhere this account is signed in, so somebody can see a session they do not recognise and end
 * it. Includes this one, marked as this one, since a list that quietly omitted it would look wrong
 * to anybody counting.
 */
const fetchDevices = async (): Promise<Device[]> => {
  return (await readFromServer('/api/account/devices', DeviceListSchema)).devices;
};

/**
 * Signs one device out, ending its session, for the account page where somebody reviews where they
 * are signed in.
 *
 * @param deviceId - The session to end.
 */
const endDevice = async (deviceId: string): Promise<boolean> => {
  const response = await fetch(`/api/account/devices/${deviceId}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null);

  return response !== null && response.ok;
};

/**
 * Ends every session but this one, which is what somebody does after losing a device or suspecting
 * their password. Deliberately keeps the session it is called from, so nobody locks themselves out
 * of the page they are securing their account on.
 */
const endOtherDevices = async (): Promise<boolean> => {
  const response = await fetch('/api/account/devices/end-others', {
    method: 'POST',
    credentials: 'same-origin',
  }).catch(() => null);

  return response !== null && response.ok;
};

export type { Device };

export { fetchDevices, endDevice, endOtherDevices };
