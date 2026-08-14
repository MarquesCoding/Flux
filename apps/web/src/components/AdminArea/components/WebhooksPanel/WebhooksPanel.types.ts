import type { WebhookDelivery, WebhookSubscription } from '@FluxContracts/schemas/Webhook';
import type { CreatedWebhook, NewWebhook, Refusal } from '@FluxWeb/admin/fetchWebhooks';

type WebhooksPanelProps = {
  webhooks: WebhookSubscription[];
  /**
   * The subscription just made, still showing its secret.
   *
   * Held by the panel's owner rather than the panel, because it must survive
   * the reload of the listing that follows a creation. A secret that vanished
   * when the list refreshed would be a secret nobody could write down.
   */
  created: CreatedWebhook | null;
  onCreate: (webhook: NewWebhook) => Promise<Refusal>;
  onDismissCreated: () => void;
  onSetEnabled: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  /**
   * What has been sent to the subscription whose history is open.
   *
   * Held above the panel because it is fetched per subscription rather than
   * with the listing: a server with twenty subscriptions should not read
   * twenty histories to draw a page where nineteen of them are closed.
   */
  deliveries: WebhookDelivery[];
  /**
   * Which subscription's history is open, or null when none is.
   */
  openHistoryId: string | null;
  isHistoryLoading: boolean;
  onOpenHistory: (id: string | null) => void;
  onRedeliver: (subscriptionId: string, deliveryId: string) => void;
};

export type { WebhooksPanelProps };
