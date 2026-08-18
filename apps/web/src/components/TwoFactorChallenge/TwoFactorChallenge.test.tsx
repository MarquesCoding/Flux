import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TwoFactorChallenge } from './TwoFactorChallenge';

const verifyTotp = vi.hoisted(() => vi.fn());
const verifyBackupCode = vi.hoisted(() => vi.fn());

vi.mock('@FluxClient/session/auth', () => ({ verifyTotp, verifyBackupCode }));

const respondWith = (accepted: boolean) => {
  verifyTotp.mockResolvedValue(accepted);
  verifyBackupCode.mockResolvedValue(accepted);
};

beforeEach(() => {
  verifyTotp.mockReset();
  verifyBackupCode.mockReset();
  respondWith(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TwoFactorChallenge', () => {
  it('asks for an authenticator code first', () => {
    render(<TwoFactorChallenge onVerified={vi.fn()} />);

    expect(screen.getByLabelText('Authenticator code')).toBeInTheDocument();
  });

  it('rejects a code that is not six digits without contacting the server', async () => {
    const actor = userEvent.setup();
    render(<TwoFactorChallenge onVerified={vi.fn()} />);

    await actor.type(screen.getByLabelText('Authenticator code'), '123');
    await actor.click(screen.getByRole('button', { name: 'Verify' }));

    expect(verifyTotp).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('6 digits');
  });

  it('checks a valid code against the authenticator', async () => {
    const actor = userEvent.setup();
    render(<TwoFactorChallenge onVerified={vi.fn()} />);

    await actor.type(screen.getByLabelText('Authenticator code'), '123456');
    await actor.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(verifyTotp).toHaveBeenCalledWith('123456');
    });
  });

  it('reports success to its parent', async () => {
    const onVerified = vi.fn();
    const actor = userEvent.setup();
    render(<TwoFactorChallenge onVerified={onVerified} />);

    await actor.type(screen.getByLabelText('Authenticator code'), '123456');
    await actor.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(onVerified).toHaveBeenCalledOnce();
    });
  });

  it('does not sign in when the code is rejected', async () => {
    respondWith(false);
    const onVerified = vi.fn();
    const actor = userEvent.setup();
    render(<TwoFactorChallenge onVerified={onVerified} />);

    await actor.type(screen.getByLabelText('Authenticator code'), '123456');
    await actor.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('not valid');
    expect(onVerified).not.toHaveBeenCalled();
  });

  it('switches to backup codes', async () => {
    const actor = userEvent.setup();
    render(<TwoFactorChallenge onVerified={vi.fn()} />);

    await actor.click(screen.getByRole('button', { name: /Use a backup code/ }));

    expect(screen.getByLabelText('Backup code')).toBeInTheDocument();
  });

  it('checks a backup code as a backup code', async () => {
    const actor = userEvent.setup();
    render(<TwoFactorChallenge onVerified={vi.fn()} />);

    await actor.click(screen.getByRole('button', { name: /Use a backup code/ }));
    await actor.type(screen.getByLabelText('Backup code'), 'abcd-efgh');
    await actor.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(verifyBackupCode).toHaveBeenCalledWith('abcd-efgh');
      expect(verifyTotp).not.toHaveBeenCalled();
    });
  });

  it('does not apply the six digit rule to backup codes', async () => {
    const actor = userEvent.setup();
    render(<TwoFactorChallenge onVerified={vi.fn()} />);

    await actor.click(screen.getByRole('button', { name: /Use a backup code/ }));
    await actor.type(screen.getByLabelText('Backup code'), 'abcd-efgh');
    await actor.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(verifyBackupCode).toHaveBeenCalledOnce();
    });
  });

  it('clears a typed code when switching modes', async () => {
    const actor = userEvent.setup();
    render(<TwoFactorChallenge onVerified={vi.fn()} />);

    await actor.type(screen.getByLabelText('Authenticator code'), '123456');
    await actor.click(screen.getByRole('button', { name: /Use a backup code/ }));

    expect(screen.getByLabelText('Backup code')).toHaveValue('');
  });

  it('brings no way out of its own, since the screen around it has one', () => {
    render(<TwoFactorChallenge onVerified={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /Back to sign in/ })).not.toBeInTheDocument();
  });

  it('reports an unreachable server rather than failing silently', async () => {
    verifyTotp.mockRejectedValue(new Error('offline'));
    const actor = userEvent.setup();
    render(<TwoFactorChallenge onVerified={vi.fn()} />);

    await actor.type(screen.getByLabelText('Authenticator code'), '123456');
    await actor.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not reach the server/);
  });
});
