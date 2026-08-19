const SERVICE_WORKER_PATH = '/push-worker.js';

/**
 * Turns the server's public key into the byte array the push API insists on, since the key travels
 * as base64url and the browser will only take bytes.
 *
 * @param base64Url - The server's public key, as base64url.
 * @returns The same key as bytes.
 */
const toApplicationServerKey = (base64Url: string): ArrayBuffer => {
  const padded = base64Url.padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), '=');
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);

  for (let at = 0; at < binary.length; at += 1) {
    bytes[at] = binary.charCodeAt(at);
  }

  return bytes.buffer;
};

/**
 * Reads a key the browser hands back and writes it as base64url, which is how it has to travel to
 * the server as JSON.
 *
 * @param buffer - The key as the browser gave it.
 * @returns The key as base64url.
 */
const toBase64Url = (buffer: ArrayBuffer | null): string => {
  if (buffer === null) {
    return '';
  }

  const binary = String.fromCharCode(...new Uint8Array(buffer));

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * Whether this browser can be woken at all, which needs a service worker, the push machinery and a
 * secure context. Asked before offering push, since a switch that cannot do anything is worse than
 * no switch.
 */
const canReceivePush = (): boolean =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/**
 * Asks this browser to accept push messages and tells the server where to knock, so a notification
 * arrives when the application is closed. Answers with what went wrong rather than throwing: refusing
 * permission is an ordinary outcome, not an error.
 *
 * @param publicKey - The server's public key.
 * @returns Whether it worked, and why not where it did not.
 */
const subscribeToPush = async (publicKey: string): Promise<boolean> => {
  if (!canReceivePush() || publicKey === '') {
    return false;
  }

  if ((await Notification.requestPermission()) !== 'granted') {
    return false;
  }

  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: toApplicationServerKey(publicKey),
  });

  const response = await fetch('/api/notifications/push', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      p256dh: toBase64Url(subscription.getKey('p256dh')),
      auth: toBase64Url(subscription.getKey('auth')),
    }),
  }).catch(() => null);

  return response !== null && response.ok;
};

/**
 * Stops this browser being woken, telling both the browser and the server. Either alone leaves a
 * subscription that one side believes in and the other does not.
 */
const unsubscribeFromPush = async (): Promise<void> => {
  if (!canReceivePush()) {
    return;
  }

  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_PATH);
  const subscription = await registration?.pushManager.getSubscription();

  if (subscription === null || subscription === undefined) {
    return;
  }

  await fetch('/api/notifications/push', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => null);

  await subscription.unsubscribe();
};

export { canReceivePush, subscribeToPush, unsubscribeFromPush };
