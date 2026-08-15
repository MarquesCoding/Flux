/**
 * Where the service worker that receives pushes is served from.
 *
 * At the root rather than under a directory, because a service worker may
 * only control pages at or below its own path — one served from `/assets/`
 * could not wake the app.
 */
const SERVICE_WORKER_PATH = '/push-worker.js';

/**
 * Turns the server's public key into the bytes the browser asks for.
 *
 * The key travels as base64url because it goes through JSON; `subscribe`
 * wants raw bytes. Padding has to be put back because base64url drops it and
 * `atob` will not.
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
 * Reads a key the browser hands back as base64url, for sending as JSON.
 */
const toBase64Url = (buffer: ArrayBuffer | null): string => {
  if (buffer === null) {
    return '';
  }

  const binary = String.fromCharCode(...new Uint8Array(buffer));

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * Whether this browser can be woken at all.
 *
 * Three separate capabilities, and a browser may have some without others —
 * iOS Safari gained push years after service workers, and a page served over
 * plain HTTP has neither. Asked before anything is offered, so somebody is
 * not shown a switch that cannot work.
 */
const canReceivePush = (): boolean =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/**
 * Asks this browser to be woken, and tells the server where to knock.
 *
 * The permission prompt belongs to the browser and cannot be moved or
 * styled — which is why this is only ever called from a press. A prompt that
 * appears unbidden on page load is the one people deny for ever, and a denied
 * permission cannot be asked for again.
 *
 * False where the browser cannot do it, where the server has no key, or where
 * somebody said no. All three are ordinary answers rather than failures, and
 * the caller shows the switch as off in every case.
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
 * Stops this browser being woken, on both sides.
 *
 * The server is told first. A browser that unsubscribed locally but stayed in
 * the table would be pushed to until the push service said it was gone, which
 * is a delivery somebody switched off still being attempted.
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

export { canReceivePush, subscribeToPush, unsubscribeFromPush, SERVICE_WORKER_PATH };
