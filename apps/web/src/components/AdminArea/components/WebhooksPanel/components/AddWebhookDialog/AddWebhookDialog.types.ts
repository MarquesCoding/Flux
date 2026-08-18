import type { NewWebhook, Refusal } from '@FluxClient/admin/fetchWebhooks';

type AddWebhookDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (webhook: NewWebhook) => Promise<Refusal>;
};

export type { AddWebhookDialogProps };
