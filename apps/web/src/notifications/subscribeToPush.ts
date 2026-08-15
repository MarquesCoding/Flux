const SERVICE_WORKER_PATH = '/push-worker.js';

/**
 * Turns the server's public key into the bytes the browser asks for.
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
 */
const canReceivePush = (): boolean =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/**
 * Asks this browser to be woken, and tells the server where to knock.
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
