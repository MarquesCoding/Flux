import type { NewWebhook, Refusal } from '@ValenceClient/admin/fetchWebhooks';
import type { WebhookFilterChoice } from '../WebhookFilterList/WebhookFilterList.types';

type AddWebhookDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (webhook: NewWebhook) => Promise<Refusal>;
  accounts: WebhookFilterChoice[];
  profiles: WebhookFilterChoice[];
};

export type { AddWebhookDialogProps };
