import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AddWebhookDialog } from './AddWebhookDialog';
import type { NewWebhook, Refusal } from '@ValenceClient/admin/fetchWebhooks';
import type { WebhookFilters } from '@ValenceContracts/schemas/Webhook';

type Creating = (webhook: NewWebhook) => Promise<Refusal>;

const draw = (overrides: Partial<Parameters<typeof AddWebhookDialog>[0]> = {}) => {
  const onCreate = vi.fn<Creating>().mockResolvedValue(null);
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    onCreate,
    accounts: [
      { id: 'account-1', label: 'Ada' },
      { id: 'account-2', label: 'Grace' },
    ],
    profiles: [
      { id: 'profile-1', label: 'Ada' },
      { id: 'profile-2', label: 'Grace' },
    ],
    ...overrides,
  };

  render(<AddWebhookDialog {...props} />);

  return { ...props, onCreate };
};

/**
 * The filters the dialog last asked for, so a test can read one field rather than the whole payload.
 */
const filtersSent = (onCreate: ReturnType<typeof draw>['onCreate']): WebhookFilters => {
  const asked = onCreate.mock.calls[0]?.[0];

  if (asked === undefined) {
    throw new Error('Nothing was created.');
  }

  return asked.filters;
};

const openPane = async (user: ReturnType<typeof userEvent.setup>, pane: string) => {
  await user.click(screen.getByRole('tab', { name: pane }));
};

const fillIn = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByRole('textbox', { name: /Name/ }), 'Discord');
  await user.type(screen.getByRole('textbox', { name: /Address/ }), 'https://example.com/hook');
};

describe('AddWebhookDialog', () => {
  it('will not add one before it has been told where to send', () => {
    draw();

    expect(screen.getByRole('button', { name: 'Add webhook' })).toBeDisabled();
  });

  it('starts listening for failures rather than for everything', async () => {
    const user = userEvent.setup();

    draw();
    await openPane(user, 'Events');

    expect(screen.getByRole('checkbox', { name: 'Job failed' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Job finished' })).not.toBeChecked();
  });

  it('adds one', async () => {
    const user = userEvent.setup();
    const { onCreate } = draw();

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Add webhook' }));

    expect(onCreate).toHaveBeenCalledWith({
      name: 'Discord',
      url: 'https://example.com/hook',
      preset: 'generic',
      events: ['job.failed'],
      filters: { mediaAdded: 'perScan', accounts: [], profiles: [], itemTypes: [] },
    });
  });

  it('starts a new subscription telling everybody about everything', async () => {
    const user = userEvent.setup();
    const { onCreate } = draw();

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Add webhook' }));

    expect(filtersSent(onCreate)).toMatchObject({ accounts: [], profiles: [], itemTypes: [] });
  });

  it('narrows a subscription to one account without touching the others', async () => {
    const user = userEvent.setup();
    const { onCreate } = draw();

    await fillIn(user);

    await openPane(user, 'Who');

    await user.click(
      within(screen.getByRole('group', { name: 'Which accounts' })).getByRole('button', {
        name: 'Only these',
      }),
    );

    const accounts = within(screen.getByRole('group', { name: 'Accounts' }));

    await user.click(accounts.getByRole('checkbox', { name: 'Ada' }));
    await user.click(screen.getByRole('button', { name: 'Add webhook' }));

    expect(filtersSent(onCreate)).toMatchObject({ accounts: ['account-1'], profiles: [] });
  });

  it('asks for arrivals one at a time when that is chosen', async () => {
    const user = userEvent.setup();
    const { onCreate } = draw();

    await fillIn(user);
    await openPane(user, 'Who');
    await user.click(screen.getByRole('button', { name: 'One for each thing' }));
    await user.click(screen.getByRole('button', { name: 'Add webhook' }));

    expect(filtersSent(onCreate)).toMatchObject({ mediaAdded: 'perItem' });
  });

  it('sends the shape somebody picked', async () => {
    const user = userEvent.setup();
    const { onCreate } = draw();

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: /ntfy/ }));
    await user.click(screen.getByRole('button', { name: 'Add webhook' }));

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ preset: 'ntfy' }));
  });

  it('will not add one that listens for nothing', async () => {
    const user = userEvent.setup();

    draw();

    await fillIn(user);
    await openPane(user, 'Events');
    await user.click(screen.getByRole('checkbox', { name: 'Job failed' }));

    expect(screen.getByRole('button', { name: 'Add webhook' })).toBeDisabled();
  });

  it('shows why an address was refused, against the address', async () => {
    const user = userEvent.setup();

    draw({
      onCreate: vi
        .fn()
        .mockResolvedValue({ message: 'Valence will not send deliveries to that address.' }),
    });

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Add webhook' }));

    expect(
      await screen.findByText('Valence will not send deliveries to that address.'),
    ).toBeInTheDocument();
  });

  it('stays open when it was refused, so the typing is not lost', async () => {
    const user = userEvent.setup();
    const { onClose } = draw({
      onCreate: vi.fn().mockResolvedValue({ message: 'No.' }),
    });

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Add webhook' }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Discord');
  });

  it('closes once one has been added', async () => {
    const user = userEvent.setup();
    const { onClose } = draw();

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Add webhook' }));

    expect(onClose).toHaveBeenCalled();
  });
});
