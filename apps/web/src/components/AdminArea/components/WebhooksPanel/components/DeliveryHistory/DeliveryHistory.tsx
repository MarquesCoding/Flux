import { Badge } from '@FluxUI/Badge';
import { Button } from '@FluxUI/Button';
import { Spinner } from '@FluxUI/Spinner';
import { WEBHOOK_EVENT_LABELS } from '@FluxContracts/schemas/Webhook';
import { describeSince } from '@FluxWeb/components/AdminArea/describeSince';
import type { DeliveryHistoryProps } from './DeliveryHistory.types';

/**
 * What a subscription has been sent lately and how each attempt went, with a way to send any of them
 * again. Redelivery is offered only where the subscription is still delivering — sending again to
 * somewhere paused would go nowhere.
 *
 * @param deliveries - The attempts, most recent first.
 * @param isLoading - Whether they are still being fetched.
 * @param canRedeliver - Whether the subscription is in a state to be sent to again.
 * @param onRedeliver - Called with the delivery to send again.
 */
const DeliveryHistory = ({
  deliveries,
  isLoading,
  canRedeliver,
  onRedeliver,
}: DeliveryHistoryProps) => {
  const now = Date.now();

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner label="Reading what has been sent" />
      </div>
    );
  }

  if (deliveries.length === 0) {
    return <p className="py-2 text-xs text-text-muted">Nothing has been sent to this yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {deliveries.map((delivery) => (
        <li key={delivery.id} className="flex flex-wrap items-center gap-2 text-xs">
          <Badge tone={delivery.ok ? 'quiet' : 'danger'} size="sm">
            {delivery.ok ? 'Delivered' : 'Failed'}
          </Badge>

          <span className="text-text">{WEBHOOK_EVENT_LABELS[delivery.event]}</span>

          <span className="text-text-muted">{describeSince(delivery.lastAttemptAt, now)}</span>

          {delivery.attempts === 1 ? null : (
            <span className="text-text-muted">{delivery.attempts.toString()} tries</span>
          )}

          {delivery.error === null ? null : <span className="text-danger">{delivery.error}</span>}

          {delivery.ok ? null : (
            <Button
              variant="secondary"
              isPill
              size="sm"
              disabled={!canRedeliver}
              onClick={() => {
                onRedeliver(delivery.id);
              }}
            >
              Send again
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
};

DeliveryHistory.displayName = 'DeliveryHistory';

export { DeliveryHistory };
