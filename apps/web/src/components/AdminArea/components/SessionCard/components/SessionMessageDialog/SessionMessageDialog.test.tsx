import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SESSION_MESSAGE_MAX_LENGTH } from '@FluxContracts/schemas/SessionMessage';
import { SessionMessageDialog } from './SessionMessageDialog';

const props = {
  viewerName: 'Dan',
  isOpen: true,
  isBusy: false,
  onClose: vi.fn(),
  onSend: vi.fn(),
};

describe('SessionMessageDialog', () => {
  it('says who the message is going to', () => {
    render(<SessionMessageDialog {...props} />);

    expect(screen.getByLabelText('Message for Dan')).toBeInTheDocument();
  });

  it('sends what was typed, without the space around it', async () => {
    const onSend = vi.fn();

    render(<SessionMessageDialog {...props} onSend={onSend} />);
    await userEvent.type(screen.getByLabelText('Message for Dan'), '  Dinner is ready.  ');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(onSend).toHaveBeenCalledWith('Dinner is ready.');
  });

  it('will not send nothing', () => {
    render(<SessionMessageDialog {...props} />);

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('refuses more than the banner can hold, rather than cutting the sentence short', async () => {
    const onSend = vi.fn();

    render(<SessionMessageDialog {...props} onSend={onSend} />);
    await userEvent.type(
      screen.getByLabelText('Message for Dan'),
      'a'.repeat(SESSION_MESSAGE_MAX_LENGTH + 1),
    );

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.getByText('That is longer than the banner can hold.')).toBeInTheDocument();
  });

  it('forgets what was typed when the admin thinks better of it', async () => {
    const onClose = vi.fn();

    render(<SessionMessageDialog {...props} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText('Message for Dan'), 'Never mind');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
    expect(screen.getByLabelText('Message for Dan')).toHaveValue('');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(SessionMessageDialog.displayName).toBe('SessionMessageDialog');
  });
});
