import { Badge } from '@FluxUI/Badge';
import { Button } from '@FluxUI/Button';
import { Spinner } from '@FluxUI/Spinner';
import { WEBHOOK_EVENT_LABELS } from '@FluxContracts/schemas/Webhook';
import { describeSince } from '@FluxWeb/components/AdminArea/describeSince';
import type { DeliveryHistoryProps } from './DeliveryHistory.types';

/**
 * What was sent lately, and how it went each time.
 *
 * The count of attempts is shown wherever it is more than one, because that
 * is the number that separates a receiver which was briefly down from one
 * that is failing: `3 tries` against a delivered event is a blip, and the
 * same number against a failed one is a receiver that never answered.
 *
 * Resending is offered on failures only. A delivery that landed can be sent
 * again — the route allows it — but offering it invites somebody to duplicate
 * an event a receiver already acted on, for no reason anybody has.
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
