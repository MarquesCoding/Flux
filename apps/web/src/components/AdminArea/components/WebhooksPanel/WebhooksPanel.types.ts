import type { WebhookDelivery, WebhookSubscription } from '@FluxContracts/schemas/Webhook';
import type { CreatedWebhook, NewWebhook, Refusal } from '@FluxWeb/admin/fetchWebhooks';

type WebhooksPanelProps = {
  webhooks: WebhookSubscription[];
  created: CreatedWebhook | null;
  onCreate: (webhook: NewWebhook) => Promise<Refusal>;
  onDismissCreated: () => void;
  onSetEnabled: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  deliveries: WebhookDelivery[];
  openHistoryId: string | null;
  isHistoryLoading: boolean;
  onOpenHistory: (id: string | null) => void;
  onRedeliver: (subscriptionId: string, deliveryId: string) => void;
};

export type { WebhooksPanelProps };
