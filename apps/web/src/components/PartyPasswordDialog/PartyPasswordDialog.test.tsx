import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PartyPasswordDialog } from './PartyPasswordDialog';

describe('PartyPasswordDialog', () => {
  it('is not there until a party asks', () => {
    render(
      <PartyPasswordDialog isOpen={false} wasWrong={false} onJoin={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });

  it('asks for the password', () => {
    render(<PartyPasswordDialog isOpen wasWrong={false} onJoin={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('joins with what was typed', async () => {
    const actor = userEvent.setup();
    const onJoin = vi.fn();

    render(<PartyPasswordDialog isOpen wasWrong={false} onJoin={onJoin} onClose={vi.fn()} />);
    await actor.type(screen.getByLabelText('Password'), 'letmein');
    await actor.click(screen.getByRole('button', { name: 'Join' }));

    expect(onJoin).toHaveBeenCalledWith('letmein');
  });

  it('will not send an empty answer', () => {
    render(<PartyPasswordDialog isOpen wasWrong={false} onJoin={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Join' })).toBeDisabled();
  });

  it('says plainly when the last answer was wrong', () => {
    render(<PartyPasswordDialog isOpen wasWrong onJoin={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText('That is not the password for this party.')).toBeInTheDocument();
  });

  it('says nothing about being wrong before anything has been tried', () => {
    render(<PartyPasswordDialog isOpen wasWrong={false} onJoin={vi.fn()} onClose={vi.fn()} />);

    expect(screen.queryByText(/not the password/)).not.toBeInTheDocument();
  });

  it('offers a way out for somebody who does not have it', async () => {
    const actor = userEvent.setup();
    const onClose = vi.fn();

    render(<PartyPasswordDialog isOpen wasWrong={false} onJoin={vi.fn()} onClose={onClose} />);
    await actor.click(screen.getByRole('button', { name: 'Not now' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(PartyPasswordDialog.displayName).toBe('PartyPasswordDialog');
  });
});
