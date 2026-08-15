import { sendWebPush } from './sendWebPush';
import type { NotificationEvent } from '@FluxContracts/schemas/Notification';
import type { NotificationStore } from './NotificationStore';
import type { VapidKeys, WebPushSender } from './sendWebPush';

type NotifyHouseholdOptions = {
  store: NotificationStore;
  event: NotificationEvent;
  title: string;
  body: string;
  link: string | null;
  vapid: VapidKeys | null;
  send?: WebPushSender;
  onProblem?: (reason: string) => void;
};

/**
 * Tells the household something, by every transport they asked for.
 *
 * @param store Where notifications, preferences and browsers are kept.
 * @param event Which event this is, so preferences can be read against it.
 * @param title What the notification is called.
 * @param body The sentence the digest wrote.
 * @param link Where pressing it goes, where there is somewhere honest.
 * @param vapid The push identity, or null where the server has none.
 * @param send How to reach a push service, so a test need not.
 * @param onProblem Told when something could not be delivered.
 */
const notifyHousehold = async ({
  store,
  event,
  title,
  body,
  link,
  vapid,
  send,
  onProblem,
}: NotifyHouseholdOptions): Promise<void> => {
  try {
    const wantInApp = await store.listWanting(event, 'inApp');

    await store.notify(wantInApp, { event, title, body, link });

    if (vapid === null) {
      return;
    }

    const wantPush = await store.listWanting(event, 'push');

    for (const userId of wantPush) {
      for (const endpoint of await store.listPushEndpoints(userId)) {
        const outcome = await sendWebPush(endpoint, { title, body, link }, vapid, send);

        if (outcome === 'gone') {
          await store.removePushEndpoint(endpoint.endpoint);
        }
      }
    }
  } catch (error) {
    onProblem?.(error instanceof Error ? error.message : 'The household could not be told.');
  }
};

export { notifyHousehold };
