import type { WebhookDelivery } from '@ValenceContracts/schemas/Webhook';

type DeliveryHistoryProps = {
  deliveries: WebhookDelivery[];
  isLoading: boolean;
  canRedeliver: boolean;
  onRedeliver: (deliveryId: string) => void;
};

export type { DeliveryHistoryProps };
