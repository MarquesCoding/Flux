import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SESSION_MESSAGE_MAX_LENGTH } from '@ValenceContracts/schemas/SessionMessage';
import { SessionMessageDialog } from './SessionMessageDialog';

const props = {
  watcher: 'Dan',
  isOpen: true,
  onSend: () => Promise.resolve(),
  onClose: () => {},
};

describe('SessionMessageDialog', () => {
  it('says who is going to read it, so the right screen is picked', () => {
    render(<SessionMessageDialog {...props} />);

    expect(screen.getByText('Message Dan')).toBeInTheDocument();
  });

  it('promises not to interrupt what they are watching', () => {
    render(<SessionMessageDialog {...props} />);

    expect(screen.getByText(/will not pause/)).toBeInTheDocument();
  });

  it('sends what was typed', async () => {
    const actor = userEvent.setup();
    const onSend = vi.fn(() => Promise.resolve());

    render(<SessionMessageDialog {...props} onSend={onSend} />);
    await actor.type(screen.getByLabelText('What to tell them'), 'Tea is ready');
    await actor.click(screen.getByRole('button', { name: 'Send' }));

    expect(onSend).toHaveBeenCalledWith('Tea is ready');
  });

  it('trims what was typed, so a stray space is not the message', async () => {
    const actor = userEvent.setup();
    const onSend = vi.fn(() => Promise.resolve());

    render(<SessionMessageDialog {...props} onSend={onSend} />);
    await actor.type(screen.getByLabelText('What to tell them'), '  Tea is ready  ');
    await actor.click(screen.getByRole('button', { name: 'Send' }));

    expect(onSend).toHaveBeenCalledWith('Tea is ready');
  });

  it('will not send nothing', () => {
    render(<SessionMessageDialog {...props} />);

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('will not send a line of only spaces', async () => {
    const actor = userEvent.setup();

    render(<SessionMessageDialog {...props} />);
    await actor.type(screen.getByLabelText('What to tell them'), '   ');

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('says how much room is left rather than cutting the ending off', async () => {
    const actor = userEvent.setup();

    render(<SessionMessageDialog {...props} />);
    await actor.type(screen.getByLabelText('What to tell them'), 'Tea');

    expect(
      screen.getByText(new RegExp(`3 of ${SESSION_MESSAGE_MAX_LENGTH.toString()}`)),
    ).toBeInTheDocument();
  });

  it('refuses to send one too long for the banner, rather than truncating it', async () => {
    const actor = userEvent.setup();

    render(<SessionMessageDialog {...props} />);
    await actor.type(
      screen.getByLabelText('What to tell them'),
      'a'.repeat(SESSION_MESSAGE_MAX_LENGTH + 1),
    );

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.getByText(/too long/)).toBeInTheDocument();
  });

  it('closes once the message has gone', async () => {
    const actor = userEvent.setup();
    const onClose = vi.fn();

    render(<SessionMessageDialog {...props} onClose={onClose} />);
    await actor.type(screen.getByLabelText('What to tell them'), 'Tea is ready');
    await actor.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('sends nothing when cancelled', async () => {
    const actor = userEvent.setup();
    const onSend = vi.fn(() => Promise.resolve());

    render(<SessionMessageDialog {...props} onSend={onSend} />);
    await actor.type(screen.getByLabelText('What to tell them'), 'Tea is ready');
    await actor.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onSend).not.toHaveBeenCalled();
  });

  it('starts empty each time it is opened, so a message is not sent twice', () => {
    const { rerender } = render(<SessionMessageDialog {...props} isOpen={false} />);

    rerender(<SessionMessageDialog {...props} isOpen />);

    expect(screen.getByLabelText('What to tell them')).toHaveValue('');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(SessionMessageDialog.displayName).toBe('SessionMessageDialog');
  });
});
