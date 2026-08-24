import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EditWebhookDialog } from './EditWebhookDialog';
import type { WebhookSubscription } from '@ValenceContracts/schemas/Webhook';
import type { Refusal, WebhookChange } from '@ValenceClient/admin/fetchWebhooks';

type Saving = (id: string, change: WebhookChange) => Promise<Refusal>;

const aWebhook = (overrides: Partial<WebhookSubscription> = {}): WebhookSubscription => ({
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  name: 'Discord',
  url: 'https://discord.com/api/webhooks/1/abc',
  preset: 'discord',
  events: ['job.failed'],
  filters: { mediaAdded: 'perScan', accounts: [], profiles: [], itemTypes: [] },
  enabled: true,
  createdAt: '2026-08-14T20:00:00.000Z',
  lastAttemptAt: null,
  lastStatus: null,
  lastError: null,
  ...overrides,
});

const draw = (overrides: Partial<Parameters<typeof EditWebhookDialog>[0]> = {}) => {
  const onSave = vi.fn<Saving>().mockResolvedValue(null);
  const props = {
    webhook: aWebhook(),
    onClose: vi.fn(),
    onSave,
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

  render(<EditWebhookDialog {...props} />);

  return { ...props, onSave };
};

const openPane = async (user: ReturnType<typeof userEvent.setup>, pane: string) => {
  await user.click(screen.getByRole('tab', { name: pane }));
};

/**
 * What the dialog last asked the server to change.
 */
const changeSent = (onSave: ReturnType<typeof draw>['onSave']): WebhookChange => {
  const asked = onSave.mock.calls[0]?.[1];

  if (asked === undefined) {
    throw new Error('Nothing was saved.');
  }

  return asked;
};

describe('EditWebhookDialog', () => {
  it('shows nothing at all when no subscription is being edited', () => {
    draw({ webhook: null });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens already filled in with what the subscription says', () => {
    draw();

    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Discord');
    expect(screen.getByRole('textbox', { name: /Address/ })).toHaveValue(
      'https://discord.com/api/webhooks/1/abc',
    );
  });

  it('shows the events it already asks for', async () => {
    const user = userEvent.setup();

    draw();
    await openPane(user, 'Events');

    expect(screen.getByRole('checkbox', { name: 'Job failed' })).toBeChecked();
  });

  it('changes which events it asks for without making a second subscription', async () => {
    const user = userEvent.setup();
    const { onSave } = draw();

    await openPane(user, 'Events');
    await user.click(screen.getByRole('checkbox', { name: 'Started watching' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(changeSent(onSave).events).toStrictEqual(['job.failed', 'playback.started']);
  });

  it('saves against the subscription it was opened for', async () => {
    const user = userEvent.setup();
    const { onSave } = draw();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onSave.mock.calls[0]?.[0]).toBe(aWebhook().id);
  });

  it('keeps a filter that was already set rather than clearing it on save', async () => {
    const user = userEvent.setup();
    const { onSave } = draw({
      webhook: aWebhook({
        filters: { mediaAdded: 'perItem', accounts: ['account-1'], profiles: [], itemTypes: [] },
      }),
    });

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(changeSent(onSave).filters).toMatchObject({
      mediaAdded: 'perItem',
      accounts: ['account-1'],
    });
  });

  it('narrows to a profile without disturbing the accounts list', async () => {
    const user = userEvent.setup();
    const { onSave } = draw();

    await openPane(user, 'Who');

    await user.click(
      within(screen.getByRole('group', { name: 'Which profiles' })).getByRole('button', {
        name: 'Only these',
      }),
    );

    const profiles = within(screen.getByRole('group', { name: 'Profiles' }));

    await user.click(profiles.getByRole('checkbox', { name: 'Ada' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(changeSent(onSave).filters).toMatchObject({ profiles: ['profile-1'], accounts: [] });
  });

  it('will not save a subscription that listens for nothing', async () => {
    const user = userEvent.setup();

    draw();

    await openPane(user, 'Events');
    await user.click(screen.getByRole('checkbox', { name: 'Job failed' }));

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('drops an event a subscription can no longer ask for, rather than sending it back', async () => {
    const user = userEvent.setup();
    const { onSave } = draw({
      webhook: aWebhook({ events: ['job.failed', 'webhook.test'] }),
    });

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(changeSent(onSave).events).toStrictEqual(['job.failed']);
  });

  it('shows a refusal where it can be read, whichever pane is open', async () => {
    const user = userEvent.setup();

    draw({ onSave: vi.fn<Saving>().mockResolvedValue({ message: 'The server said no.' }) });

    await user.click(screen.getByRole('tab', { name: 'Events' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The server said no.');
  });

  it('shows why an address was refused', async () => {
    const user = userEvent.setup();

    draw({
      onSave: vi
        .fn<Saving>()
        .mockResolvedValue({ message: 'Valence will not send deliveries to that address.' }),
    });

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('Valence will not send deliveries to that address.'),
    ).toBeInTheDocument();
  });

  it('stays open when it was refused, so the editing is not lost', async () => {
    const user = userEvent.setup();
    const { onClose } = draw({
      onSave: vi.fn<Saving>().mockResolvedValue({ message: 'No.' }),
    });

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes once the change has been saved', async () => {
    const user = userEvent.setup();
    const { onClose } = draw();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('says the secret is left alone, which is the reason to edit rather than recreate', () => {
    draw();

    expect(screen.getByText(/signing secret stays as it is/)).toBeInTheDocument();
  });
});
