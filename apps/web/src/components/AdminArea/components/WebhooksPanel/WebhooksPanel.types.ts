import type { WebhookSubscription } from '@FluxContracts/schemas/Webhook';
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
};

export type { WebhooksPanelProps };
