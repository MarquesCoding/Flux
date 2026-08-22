import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SetupWizard } from './SetupWizard';
import { SetupRequestSchema } from '@ValenceContracts/schemas/Setup';
import type { SetupRequest, SetupStatus } from '@ValenceContracts/schemas/Setup';

const status: SetupStatus = {
  isComplete: false,
  detectedOrigin: 'http://192.168.1.40:8420',
  isSecureContext: false,
  suggestedTrustedOrigins: ['http://192.168.1.40:8420', 'http://192.168.1.40:5173'],
};

type JsonRequestInit = Omit<RequestInit, 'body'> & { body?: string };

type FetchLike = (
  input: string,
  init?: JsonRequestInit,
) => Promise<{ ok: boolean; status: number }>;

const fetchMock = vi.fn<FetchLike>();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const fillAdmin = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Name'), 'Operator');
  await user.type(screen.getByLabelText('Email'), 'admin@valence.test');
  await user.type(screen.getByLabelText('Password'), 'a-long-enough-password');
};

const lastBody = (): SetupRequest =>
  SetupRequestSchema.parse(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body ?? '{}'));

describe('SetupWizard', () => {
  it('prefills trusted origins from what the server detected', () => {
    render(<SetupWizard status={status} onComplete={vi.fn()} />);

    expect(screen.getByLabelText('Trusted origins')).toHaveValue(
      'http://192.168.1.40:8420, http://192.168.1.40:5173',
    );
  });

  it('tells the operator which origin the server saw', () => {
    render(<SetupWizard status={status} onComplete={vi.fn()} />);

    expect(screen.getByLabelText('Trusted origins')).toHaveAccessibleDescription(
      /Detected http:\/\/192\.168\.1\.40:8420/,
    );
  });

  it('leaves secure cookies off when reached over plain http', () => {
    render(<SetupWizard status={status} onComplete={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: /HTTPS/ })).not.toBeChecked();
  });

  it('turns secure cookies on when reached over https', () => {
    render(
      <SetupWizard
        status={{ ...status, isSecureContext: true, detectedOrigin: 'https://valence.example' }}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByRole('checkbox', { name: /HTTPS/ })).toBeChecked();
  });

  it('warns that secure cookies break plain http', async () => {
    const user = userEvent.setup();
    render(<SetupWizard status={status} onComplete={vi.fn()} />);

    await user.click(screen.getByRole('checkbox', { name: /HTTPS/ }));

    expect(screen.getByText(/will not work over plain HTTP/)).toBeInTheDocument();
  });

  it('does not submit when the form is invalid', async () => {
    const user = userEvent.setup();
    render(<SetupWizard status={status} onComplete={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Finish setup/ }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
  });

  it('submits the administrator and access configuration', async () => {
    const user = userEvent.setup();
    render(<SetupWizard status={status} onComplete={vi.fn()} />);

    await fillAdmin(user);
    await user.click(screen.getByRole('button', { name: /Finish setup/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    expect(lastBody()).toMatchObject({
      admin: { name: 'Operator', email: 'admin@valence.test' },
      trustedOrigins: ['http://192.168.1.40:8420', 'http://192.168.1.40:5173'],
      cookieSecure: false,
    });
  });

  it('reports completion to its parent', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<SetupWizard status={status} onComplete={onComplete} />);

    await fillAdmin(user);
    await user.click(screen.getByRole('button', { name: /Finish setup/ }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledOnce();
    });
  });

  it('explains that setup was already completed on a conflict', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409 });
    const user = userEvent.setup();
    render(<SetupWizard status={status} onComplete={vi.fn()} />);

    await fillAdmin(user);
    await user.click(screen.getByRole('button', { name: /Finish setup/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already been set up/);
  });

  it('reports an unreachable server rather than failing silently', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    render(<SetupWizard status={status} onComplete={vi.fn()} />);

    await fillAdmin(user);
    await user.click(screen.getByRole('button', { name: /Finish setup/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not reach the server/);
  });

  it('does not call onComplete when submission fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400 });
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<SetupWizard status={status} onComplete={onComplete} />);

    await fillAdmin(user);
    await user.click(screen.getByRole('button', { name: /Finish setup/ }));

    await screen.findByRole('alert');

    expect(onComplete).not.toHaveBeenCalled();
  });
});
