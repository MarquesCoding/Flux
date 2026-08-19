import type { WebhookDelivery } from '@FluxContracts/schemas/Webhook';

type DeliveryHistoryProps = {
  deliveries: WebhookDelivery[];
  isLoading: boolean;
  canRedeliver: boolean;
  onRedeliver: (deliveryId: string) => void;
};

export type { DeliveryHistoryProps };
