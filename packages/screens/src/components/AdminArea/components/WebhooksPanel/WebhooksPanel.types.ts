import type { WebhookDelivery, WebhookSubscription } from '@ValenceContracts/schemas/Webhook';
import type {
  CreatedWebhook,
  NewWebhook,
  Refusal,
  WebhookChange,
} from '@ValenceClient/admin/fetchWebhooks';
import type { WebhookFilterChoice } from './components/WebhookFilterList/WebhookFilterList.types';

type WebhooksPanelProps = {
  webhooks: WebhookSubscription[];
  created: CreatedWebhook | null;
  onCreate: (webhook: NewWebhook) => Promise<Refusal>;
  onEdit: (id: string, change: WebhookChange) => Promise<Refusal>;
  accounts: WebhookFilterChoice[];
  profiles: WebhookFilterChoice[];
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
