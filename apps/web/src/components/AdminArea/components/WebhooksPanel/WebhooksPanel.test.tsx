import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WebhooksPanel } from './WebhooksPanel';
import type { WebhookSubscription } from '@FluxContracts/schemas/Webhook';
import type { CreatedWebhook } from '@FluxWeb/admin/fetchWebhooks';

const aWebhook = (overrides: Partial<WebhookSubscription> = {}): WebhookSubscription => ({
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  name: 'Discord',
  url: 'https://discord.com/api/webhooks/1/abc',
  preset: 'discord',
  events: ['job.failed'],
  enabled: true,
  createdAt: '2026-08-14T20:00:00.000Z',
  lastAttemptAt: null,
  lastStatus: null,
  lastError: null,
  ...overrides,
});

const draw = (overrides: Partial<Parameters<typeof WebhooksPanel>[0]> = {}) => {
  const props = {
    webhooks: [],
    created: null,
    onCreate: vi.fn().mockResolvedValue(null),
    onDismissCreated: vi.fn(),
    onSetEnabled: vi.fn(),
    onDelete: vi.fn(),
    onTest: vi.fn(),
    deliveries: [],
    openHistoryId: null,
    isHistoryLoading: false,
    onOpenHistory: vi.fn(),
    onRedeliver: vi.fn(),
    ...overrides,
  };

  render(<WebhooksPanel {...props} />);

  return props;
};

describe('WebhooksPanel', () => {
  it('says what this is for when nothing is set up', () => {
    draw();

    expect(screen.getByText(/Nothing is being told about anything/)).toBeInTheDocument();
  });

  it('names a subscription and where it points', () => {
    draw({ webhooks: [aWebhook()] });

    expect(screen.getByText('Discord')).toBeInTheDocument();
    expect(screen.getByText('https://discord.com/api/webhooks/1/abc')).toBeInTheDocument();
  });

  it('says when one has never been used', () => {
    draw({ webhooks: [aWebhook()] });

    expect(screen.getByText('Never used')).toBeInTheDocument();
  });

  it('leads with the fact that one is failing, which is the point of the list', () => {
    draw({
      webhooks: [
        aWebhook({
          lastAttemptAt: '2026-08-14T20:00:00.000Z',
          lastStatus: 500,
          lastError: 'The receiver answered 500.',
        }),
      ],
    });

    expect(screen.getByText(/Failing since/)).toBeInTheDocument();
    expect(screen.getByText('The receiver answered 500.')).toBeInTheDocument();
  });

  it('turns one off', async () => {
    const user = userEvent.setup();
    const { onSetEnabled } = draw({ webhooks: [aWebhook()] });

    await user.click(screen.getByRole('switch', { name: 'Enabled' }));

    expect(onSetEnabled).toHaveBeenCalledWith(aWebhook().id, false);
  });

  it('will not offer to test one that is turned off', () => {
    draw({ webhooks: [aWebhook({ enabled: false })] });

    expect(screen.getByRole('button', { name: 'Send a test' })).toBeDisabled();
  });

  it('sends a test', async () => {
    const user = userEvent.setup();
    const { onTest } = draw({ webhooks: [aWebhook()] });

    await user.click(screen.getByRole('button', { name: 'Send a test' }));

    expect(onTest).toHaveBeenCalledWith(aWebhook().id);
  });

  it('asks before deleting, and says the secret goes with it', async () => {
    const user = userEvent.setup();
    const { onDelete } = draw({ webhooks: [aWebhook()] });

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByText(/the signing secret is lost/)).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('deletes once that is confirmed', async () => {
    const user = userEvent.setup();
    const { onDelete } = draw({ webhooks: [aWebhook()] });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete', hidden: false }));

    expect(onDelete).toHaveBeenCalledWith(aWebhook().id);
  });

  it('opens the history for the subscription that was asked about', async () => {
    const user = userEvent.setup();
    const { onOpenHistory } = draw({ webhooks: [aWebhook()] });

    await user.click(screen.getByRole('button', { name: 'History' }));

    expect(onOpenHistory).toHaveBeenCalledWith(aWebhook().id);
  });

  it('closes an open history rather than opening it twice', async () => {
    const user = userEvent.setup();
    const { onOpenHistory } = draw({
      webhooks: [aWebhook()],
      openHistoryId: aWebhook().id,
    });

    await user.click(screen.getByRole('button', { name: 'Hide history' }));

    expect(onOpenHistory).toHaveBeenCalledWith(null);
  });

  it('shows the history only for the subscription it belongs to', () => {
    draw({
      webhooks: [aWebhook(), aWebhook({ id: 'other', name: 'ntfy' })],
      openHistoryId: aWebhook().id,
      deliveries: [],
    });

    expect(screen.getAllByText('Nothing has been sent to this yet.')).toHaveLength(1);
  });

  it('shows a new secret once, and says it will not be shown again', () => {
    const created: CreatedWebhook = { ...aWebhook(), secret: 'whsec_abc123' };

    draw({ created });

    expect(screen.getByText('whsec_abc123')).toBeInTheDocument();
    expect(screen.getByText(/only time it is shown/)).toBeInTheDocument();
  });

  it('lets somebody put the secret away once they have copied it', async () => {
    const user = userEvent.setup();
    const created: CreatedWebhook = { ...aWebhook(), secret: 'whsec_abc123' };
    const { onDismissCreated } = draw({ created });

    await user.click(screen.getByRole('button', { name: 'I have copied it' }));

    expect(onDismissCreated).toHaveBeenCalled();
  });
});
