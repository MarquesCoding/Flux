import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeliveryHistory } from './DeliveryHistory';
import type { WebhookDelivery } from '@ValenceContracts/schemas/Webhook';

const aDelivery = (overrides: Partial<WebhookDelivery> = {}): WebhookDelivery => ({
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  subscriptionId: '3f2504e0-4f89-41d3-9a0c-0305e82c3302',
  event: 'job.failed',
  attempts: 1,
  firstAttemptAt: '2026-08-14T20:00:00.000Z',
  lastAttemptAt: '2026-08-14T20:00:00.000Z',
  ok: true,
  status: 200,
  error: null,
  ...overrides,
});

const draw = (overrides: Partial<Parameters<typeof DeliveryHistory>[0]> = {}) => {
  const props = {
    deliveries: [],
    isLoading: false,
    canRedeliver: true,
    onRedeliver: vi.fn(),
    ...overrides,
  };

  render(<DeliveryHistory {...props} />);

  return props;
};

const aFailure = aDelivery({
  ok: false,
  status: 503,
  error: 'The receiver answered 503.',
});

describe('DeliveryHistory', () => {
  it('tells a history that has not loaded from one that is empty', () => {
    draw({ isLoading: true });

    expect(screen.getByRole('status', { name: 'Reading what has been sent' })).toBeInTheDocument();
    expect(screen.queryByText(/Nothing has been sent/)).not.toBeInTheDocument();
  });

  it('says plainly when nothing has been sent', () => {
    draw();

    expect(screen.getByText('Nothing has been sent to this yet.')).toBeInTheDocument();
  });

  it('shows what was sent and whether it landed', () => {
    draw({ deliveries: [aDelivery()] });

    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.getByText('Job failed')).toBeInTheDocument();
  });

  it('shows why a delivery failed', () => {
    draw({ deliveries: [aFailure] });

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('The receiver answered 503.')).toBeInTheDocument();
  });

  it('says nothing about tries when there was only one', () => {
    draw({ deliveries: [aDelivery()] });

    expect(screen.queryByText(/tries/)).not.toBeInTheDocument();
  });

  it('counts the tries when a receiver was briefly down', () => {
    draw({ deliveries: [aDelivery({ attempts: 3 })] });

    expect(screen.getByText('3 tries')).toBeInTheDocument();
  });

  it('offers to send a failure again', async () => {
    const user = userEvent.setup();
    const { onRedeliver } = draw({ deliveries: [aFailure] });

    await user.click(screen.getByRole('button', { name: 'Send again' }));

    expect(onRedeliver).toHaveBeenCalledWith(aFailure.id);
  });

  it('does not offer to duplicate something a receiver already acted on', () => {
    draw({ deliveries: [aDelivery()] });

    expect(screen.queryByRole('button', { name: 'Send again' })).not.toBeInTheDocument();
  });

  it('will not offer a resend that the server would refuse', () => {
    draw({ deliveries: [aFailure], canRedeliver: false });

    expect(screen.getByRole('button', { name: 'Send again' })).toBeDisabled();
  });
});
