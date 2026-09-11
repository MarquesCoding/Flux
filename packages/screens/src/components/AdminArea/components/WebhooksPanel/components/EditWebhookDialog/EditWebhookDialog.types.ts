import type { WebhookSubscription } from '@ValenceContracts/schemas/Webhook';
import type { Refusal, WebhookChange } from '@ValenceClient/admin/fetchWebhooks';
import type { WebhookFilterChoice } from '@ValenceScreens/components/AdminArea/components/WebhooksPanel/components/WebhookFilterList/WebhookFilterList.types';

type EditWebhookDialogProps = {
  webhook: WebhookSubscription | null;
  onClose: () => void;
  onSave: (id: string, change: WebhookChange) => Promise<Refusal>;
  accounts: WebhookFilterChoice[];
  profiles: WebhookFilterChoice[];
};

export type { EditWebhookDialogProps };
