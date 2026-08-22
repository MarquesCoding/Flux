import { sendWebPush } from './sendWebPush';
import type { NotificationEvent } from '@ValenceContracts/schemas/Notification';
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
  announce?: (userIds: readonly string[]) => void;
  only?: readonly string[];
};

/**
 * Tells the household something, by every means each person asked to be told by — in the app, by
 * push, or not at all. One thing that happened becomes as many deliveries as there are people
 * wanting to hear about it, and a transport failing for one person does not stop the others.
 *
 * `only` narrows it to particular people without narrowing anything else: what somebody asked to be
 * told about is still theirs to decide, so being named in an invitation is not a way around having
 * turned that kind of notification off.
 *
 * @param store Where notifications, preferences and browsers are kept.
 * @param event Which event this is, so preferences can be read against it.
 * @param title What the notification is called.
 * @param body The sentence the digest wrote.
 * @param link Where pressing it goes, where there is somewhere honest.
 * @param vapid The push identity, or null where the server has none.
 * @param send How to reach a push service, so a test need not.
 * @param onProblem Told when something could not be delivered.
 * @param announce Told who now has something waiting, so open tabs can hear about it at once.
 * @param only The people to tell, where this concerns some of the household rather than all of it. Preferences still decide how each of them hears it.
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
  announce,
  only,
}: NotifyHouseholdOptions): Promise<void> => {
  const meant = (userIds: readonly string[]): string[] =>
    only === undefined ? [...userIds] : userIds.filter((userId) => only.includes(userId));

  try {
    const wantInApp = meant(await store.listWanting(event, 'inApp'));

    await store.notify(wantInApp, { event, title, body, link });

    if (wantInApp.length > 0) {
      announce?.(wantInApp);
    }

    if (vapid === null) {
      return;
    }

    const wantPush = meant(await store.listWanting(event, 'push'));

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
