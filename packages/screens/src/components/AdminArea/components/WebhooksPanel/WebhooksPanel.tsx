import { useState } from 'react';
import { Badge } from '@FluxUI/Badge';
import { Button } from '@FluxUI/Button';
import { Card } from '@FluxUI/Card';
import { CardHeader } from '@FluxUI/CardHeader';
import { ConfirmDialog } from '@FluxUI/ConfirmDialog';
import { Switch } from '@FluxUI/Switch';
import { WEBHOOK_EVENT_LABELS } from '@FluxContracts/schemas/Webhook';
import { describeSince } from '@FluxScreens/components/AdminArea/describeSince';
import { AddWebhookDialog } from './components/AddWebhookDialog/AddWebhookDialog';
import { DeliveryHistory } from './components/DeliveryHistory/DeliveryHistory';
import type { WebhookSubscription } from '@FluxContracts/schemas/Webhook';
import type { WebhooksPanelProps } from './WebhooksPanel.types';

/**
 * Says how a subscription's last delivery went, in a word and a colour: never used, when it last
 * succeeded, or what went wrong. The failing case is coloured because a webhook that has quietly
 * stopped working looks exactly like one nothing has happened for.
 *
 * @param webhook - The subscription.
 * @param now - The moment to measure against.
 * @returns How alarming it is, and what to say.
 */
const describeLastAttempt = (
  webhook: WebhookSubscription,
  now: number,
): { tone: 'quiet' | 'danger'; label: string } => {
  if (webhook.lastAttemptAt === null) {
    return { tone: 'quiet', label: 'Never used' };
  }

  if (webhook.lastError === null) {
    return { tone: 'quiet', label: `Delivered ${describeSince(webhook.lastAttemptAt, now)}` };
  }

  return { tone: 'danger', label: `Failing since ${describeSince(webhook.lastAttemptAt, now)}` };
};

/**
 * Where an operator says what they want to be told about and sees whether they are still being told:
 * the subscriptions, what each last did, and a way to test, pause, remove or look through the
 * deliveries of any of them. A new subscription's secret is shown once, on creation, and never
 * again.
 *
 * @param webhooks - The subscriptions configured.
 * @param created - A subscription just made, whose secret is still being shown.
 * @param onCreate - Called with a subscription to make, answering with any refusal.
 * @param onDismissCreated - Called once the secret has been taken down.
 * @param onSetEnabled - Called with a subscription and whether it should be delivering.
 * @param onDelete - Called with the subscription to remove.
 * @param onTest - Called with the subscription to send a test to.
 * @param deliveries - The deliveries of whichever subscription's history is open.
 * @param openHistoryId - The subscription whose history is open, if any.
 * @param isHistoryLoading - Whether that history is still being fetched.
 * @param onOpenHistory - Called with the subscription whose history to open, or null to close it.
 * @param onRedeliver - Called with a delivery to send again.
 */
const WebhooksPanel = ({
  webhooks,
  created,
  onCreate,
  onDismissCreated,
  onSetEnabled,
  onDelete,
  onTest,
  deliveries,
  openHistoryId,
  isHistoryLoading,
  onOpenHistory,
  onRedeliver,
}: WebhooksPanelProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [deleting, setDeleting] = useState<WebhookSubscription | null>(null);
  const now = Date.now();

  return (
    <div className="flex flex-col gap-4">
      <AddWebhookDialog
        isOpen={isAdding}
        onClose={() => {
          setIsAdding(false);
        }}
        onCreate={onCreate}
      />

      <ConfirmDialog
        title={`Delete ${deleting?.name ?? 'this webhook'}?`}
        detail="Nothing more will be sent there, and the signing secret is lost. Adding it again means giving the receiver a new secret."
        confirmLabel="Delete"
        isDestructive
        isOpen={deleting !== null}
        onClose={() => {
          setDeleting(null);
        }}
        onConfirm={() => {
          if (deleting !== null) {
            onDelete(deleting.id);
          }

          setDeleting(null);
        }}
      />

      {created === null ? null : (
        <Card as="section" className="border-accent/40">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-text">
                {created.name} is set up. Copy its signing secret now.
              </span>

              <span className="text-xs text-text-muted">
                This is the only time it is shown. Give it to the receiver so it can check that a
                delivery really came from Flux. If it is lost, delete this webhook and make another.
              </span>
            </div>

            <code className="select-all break-all rounded-lg bg-[var(--surface-hover)] px-3 py-2 font-mono text-xs text-text">
              {created.secret}
            </code>

            <div className="flex justify-end">
              <Button variant="secondary" isPill size="sm" onClick={onDismissCreated}>
                I have copied it
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card as="section" padding="none" className="flex flex-col overflow-hidden">
        <CardHeader title="Webhooks">
          <Button
            variant="primary"
            isPill
            size="sm"
            onClick={() => {
              setIsAdding(true);
            }}
          >
            Add a webhook
          </Button>
        </CardHeader>

        {webhooks.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            Nothing is being told about anything. Add a webhook to have Flux post to Discord, ntfy
            or anywhere else when a job fails.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--surface-line)]">
            {webhooks.map((webhook) => {
              const attempt = describeLastAttempt(webhook, now);

              return (
                <li key={webhook.id} className="flex flex-col gap-3 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-text">{webhook.name}</span>

                    <Badge tone={attempt.tone}>{attempt.label}</Badge>

                    {webhook.enabled ? null : <Badge tone="quiet">Off</Badge>}
                  </div>

                  <span className="break-all text-xs text-text-muted">{webhook.url}</span>

                  <span className="text-xs text-text-muted">
                    {webhook.events.map((event) => WEBHOOK_EVENT_LABELS[event]).join(' · ')}
                  </span>

                  {webhook.lastError === null ? null : (
                    <span className="text-xs text-danger">{webhook.lastError}</span>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Switch
                      label="Enabled"
                      isOn={webhook.enabled}
                      onToggle={() => {
                        onSetEnabled(webhook.id, !webhook.enabled);
                      }}
                    />

                    <Button
                      variant="secondary"
                      isPill
                      size="sm"
                      disabled={!webhook.enabled}
                      onClick={() => {
                        onTest(webhook.id);
                      }}
                    >
                      Send a test
                    </Button>

                    <Button
                      variant="secondary"
                      isPill
                      size="sm"
                      aria-expanded={openHistoryId === webhook.id}
                      onClick={() => {
                        onOpenHistory(openHistoryId === webhook.id ? null : webhook.id);
                      }}
                    >
                      {openHistoryId === webhook.id ? 'Hide history' : 'History'}
                    </Button>

                    <Button
                      variant="danger"
                      isPill
                      size="sm"
                      onClick={() => {
                        setDeleting(webhook);
                      }}
                    >
                      Delete
                    </Button>
                  </div>

                  {openHistoryId === webhook.id ? (
                    <DeliveryHistory
                      deliveries={deliveries}
                      isLoading={isHistoryLoading}
                      canRedeliver={webhook.enabled}
                      onRedeliver={(deliveryId) => {
                        onRedeliver(webhook.id, deliveryId);
                      }}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
};

WebhooksPanel.displayName = 'WebhooksPanel';

export { WebhooksPanel };
