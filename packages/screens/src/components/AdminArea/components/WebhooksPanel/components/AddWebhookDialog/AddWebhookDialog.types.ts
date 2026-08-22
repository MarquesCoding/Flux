import type { NewWebhook, Refusal } from '@ValenceClient/admin/fetchWebhooks';

type AddWebhookDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (webhook: NewWebhook) => Promise<Refusal>;
};

export type { AddWebhookDialogProps };
