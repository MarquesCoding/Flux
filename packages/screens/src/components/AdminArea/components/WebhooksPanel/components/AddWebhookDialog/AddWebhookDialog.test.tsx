import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AddWebhookDialog } from './AddWebhookDialog';

const draw = (overrides: Partial<Parameters<typeof AddWebhookDialog>[0]> = {}) => {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    onCreate: vi.fn().mockResolvedValue(null),
    ...overrides,
  };

  render(<AddWebhookDialog {...props} />);

  return props;
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

  it('starts listening for failures rather than for everything', () => {
    draw();

    expect(screen.getByRole('checkbox', { name: 'A background job failed' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'A background job finished' })).not.toBeChecked();
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
    });
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
    await user.click(screen.getByRole('checkbox', { name: 'A background job failed' }));

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
