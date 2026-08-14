import type { WebhookDelivery } from '@FluxContracts/schemas/Webhook';

type DeliveryHistoryProps = {
  deliveries: WebhookDelivery[];
  /**
   * Whether the history has been asked for yet.
   *
   * Distinguished from an empty one because "nothing has been sent" and "this
   * has not loaded" look identical otherwise, and the first is a fact worth
   * stating while the second is a spinner.
   */
  isLoading: boolean;
  /**
   * Whether a redelivery can be asked for at all.
   *
   * False for a subscription that is turned off, where the server would
   * refuse — offering a button that is always refused is worse than not
   * offering one.
   */
  canRedeliver: boolean;
  onRedeliver: (deliveryId: string) => void;
};

export type { DeliveryHistoryProps };
