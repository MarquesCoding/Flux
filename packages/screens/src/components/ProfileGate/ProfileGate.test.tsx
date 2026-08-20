import { act, screen, waitFor } from '@testing-library/react';
import { renderInAnAddress } from '@FluxScreens/testing/renderInAnAddress';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileGate } from './ProfileGate';
import { authenticateWithPasskey } from '@FluxClient/session/auth';
import { isPasskeySupported } from '@FluxScreens/passkeys/isPasskeySupported';
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';

const profileOf = (name: string, at: number): ViewerProfile => ({
  id: `00000000-0000-4000-8000-${at.toString().padStart(12, '0')}`,
  name,
  colour: '#3a8ee8',
  avatar: { kind: 'initial' },
  askStillWatchingAfter: 4,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const HOUSEHOLD = ['Marques', 'Sam', 'Mum'].map(profileOf);

const many = (count: number): ViewerProfile[] =>
  Array.from({ length: count }, (_ignored, at) => profileOf(`Person ${(at + 1).toString()}`, at));

vi.mock('@FluxClient/session/auth', () => ({
  authenticateWithPasskey: vi.fn(),
}));

vi.mock('@FluxScreens/passkeys/isPasskeySupported', () => ({
  isPasskeySupported: vi.fn(),
}));




const passkeyMock = vi.mocked(authenticateWithPasskey);
const passkeySupportedMock = vi.mocked(isPasskeySupported);

const fetchMock = vi.fn();

/**
 * Answers the two things the gate reads on arrival, and the sign-in it makes.
 */
const serverWith = (
  everyone: ViewerProfile[],
  signIn: { ok: boolean; body?: string } = { ok: true },
) => {
  fetchMock.mockImplementation((input: string) => {
    if (input.includes('/everyone')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ profiles: everyone }) });
    }

    if (input.includes('/health')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ version: '1.4.2' }) });
    }

    return Promise.resolve({
      ok: signIn.ok,
      headers: new Headers(),
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(signIn.body ?? '{}'),
    });
  });
};

/**
 * Lets the wordmark finish holding the screen, which it does before anything else is drawn.
 */
const arrive = async () => {
  for (let pass = 0; pass < 4; pass += 1) {
    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
      await Promise.resolve();
    });
  }
};

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchMock.mockReset();
  serverWith(HOUSEHOLD);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ProfileGate', () => {
  it('opens on the wordmark before it asks anything', () => {
    renderInAnAddress(<ProfileGate onSignedIn={vi.fn()} />);

    expect(screen.queryByText('Who is watching?')).not.toBeInTheDocument();
  });

  it('asks who is watching once the wordmark has moved aside', async () => {
    renderInAnAddress(<ProfileGate onSignedIn={vi.fn()} />);

    await arrive();

    expect(screen.getByText('Who is watching?')).toBeInTheDocument();
  });

  it('shows everybody who could sign in', async () => {
    renderInAnAddress(<ProfileGate onSignedIn={vi.fn()} />);

    await arrive();

    expect(screen.getByRole('button', { name: /Marques/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sam/ })).toBeInTheDocument();
  });

  it('asks only for a password once a face is picked, never for an address', async () => {
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderInAnAddress(<ProfileGate onSignedIn={vi.fn()} />);

    await arrive();
    await actor.click(screen.getByRole('button', { name: /Marques/ }));

    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.queryByLabelText(/mail/i)).not.toBeInTheDocument();
  });

  it('signs in as the face that was picked', async () => {
    const onSignedIn = vi.fn();
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderInAnAddress(<ProfileGate onSignedIn={onSignedIn} />);

    await arrive();
    await actor.click(screen.getByRole('button', { name: /Marques/ }));
    await actor.type(screen.getByLabelText('Password'), 'a password');
    await actor.click(screen.getByRole('button', { name: /Watch/ }));

    await waitFor(() => {
      expect(onSignedIn).toHaveBeenCalledOnce();
    });
  });

  it('asks for a code after the password when an account has one', async () => {
    serverWith(HOUSEHOLD, { ok: true, body: JSON.stringify({ twoFactorRedirect: true }) });

    const onSignedIn = vi.fn();
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderInAnAddress(<ProfileGate onSignedIn={onSignedIn} />);

    await arrive();
    await actor.click(screen.getByRole('button', { name: /Marques/ }));
    await actor.type(screen.getByLabelText('Password'), 'a password');
    await actor.click(screen.getByRole('button', { name: /Watch/ }));

    await waitFor(() => {
      expect(screen.getByLabelText('Authenticator code')).toBeInTheDocument();
    });

    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('keeps the portrait while asking for a code, so it is plainly the same person', async () => {
    serverWith(HOUSEHOLD, { ok: true, body: JSON.stringify({ twoFactorRedirect: true }) });

    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderInAnAddress(<ProfileGate onSignedIn={vi.fn()} />);

    await arrive();
    await actor.click(screen.getByRole('button', { name: /Marques/ }));
    await actor.type(screen.getByLabelText('Password'), 'a password');
    await actor.click(screen.getByRole('button', { name: /Watch/ }));

    await waitFor(() => {
      expect(screen.getByText('Marques')).toBeInTheDocument();
    });
  });

  it('says it was the password when it was, rather than failing silently', async () => {
    serverWith(HOUSEHOLD, { ok: false });

    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderInAnAddress(<ProfileGate onSignedIn={vi.fn()} />);

    await arrive();
    await actor.click(screen.getByRole('button', { name: /Marques/ }));
    await actor.type(screen.getByLabelText('Password'), 'wrong');
    await actor.click(screen.getByRole('button', { name: /Watch/ }));

    expect(await screen.findByText('That password is not right.')).toBeInTheDocument();
  });

  it('will not send an empty password', async () => {
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderInAnAddress(<ProfileGate onSignedIn={vi.fn()} />);

    await arrive();
    await actor.click(screen.getByRole('button', { name: /Marques/ }));

    expect(screen.getByRole('button', { name: /Watch/ })).toBeDisabled();
  });

  it('goes back to the wall when somebody picked the wrong person', async () => {
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderInAnAddress(<ProfileGate onSignedIn={vi.fn()} />);

    await arrive();
    await actor.click(screen.getByRole('button', { name: /Marques/ }));
    await actor.click(screen.getByRole('button', { name: 'Somebody else' }));

    expect(screen.getByText('Who is watching?')).toBeInTheDocument();
  });

  it('goes back on escape, which is what everybody tries', async () => {
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderInAnAddress(<ProfileGate onSignedIn={vi.fn()} />);

    await arrive();
    await actor.click(screen.getByRole('button', { name: /Marques/ }));
    await actor.keyboard('{Escape}');

    expect(screen.getByText('Who is watching?')).toBeInTheDocument();
  });

  it('pages a household too large to show at once', async () => {
    serverWith(many(15));

    renderInAnAddress(<ProfileGate onSignedIn={vi.fn()} />);

    await arrive();

    expect(screen.getByRole('button', { name: /Person 1$/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Person 15/ })).not.toBeInTheDocument();
  });

  it('turns the page', async () => {
    serverWith(many(15));

    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderInAnAddress(<ProfileGate onSignedIn={vi.fn()} />);

    await arrive();
    await actor.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByRole('button', { name: /Person 15/ })).toBeInTheDocument();
  });

  it('does not offer paging to a household that fits', async () => {
    renderInAnAddress(<ProfileGate onSignedIn={vi.fn()} />);

    await arrive();

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('moves through the faces from the keyboard, for somebody holding a remote', async () => {
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderInAnAddress(<ProfileGate onSignedIn={vi.fn()} />);

    await arrive();
    await actor.keyboard('{ArrowRight}');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sam/ })).toHaveFocus();
    });
  });

  it('follows the keyboard onto the next page rather than making somebody find the arrows', async () => {
    serverWith(many(15));

    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderInAnAddress(<ProfileGate onSignedIn={vi.fn()} />);

    await arrive();

    for (let step = 0; step < 10; step += 1) {
      await actor.keyboard('{ArrowRight}');
    }

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Person 11/ })).toBeInTheDocument();
    });
  });

  it('says which version is running, since somebody self-hosting wants to know', async () => {
    renderInAnAddress(<ProfileGate onSignedIn={vi.fn()} />);

    await arrive();

    await waitFor(() => {
      expect(screen.getByText(/1\.4\.2/)).toBeInTheDocument();
    });
  });

  it('calls the instance whatever it is called', async () => {
    renderInAnAddress(<ProfileGate onSignedIn={vi.fn()} name="The Cinema" />);

    await arrive();

    expect(screen.getAllByText(/The Cinema/).length).toBeGreaterThan(0);
  });
});

describe('signing in with a passkey instead of a password', () => {
  const askedForAPassword = async () => {
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    passkeySupportedMock.mockReturnValue(true);
    serverWith(HOUSEHOLD);

    renderInAnAddress(<ProfileGate onSignedIn={vi.fn()} />);

    await arrive();
    await actor.click(screen.getByRole('button', { name: /Marques/ }));

    return actor;
  };

  it('offers a passkey when the browser has them', async () => {
    await askedForAPassword();

    expect(
      await screen.findByRole('button', { name: /Use a passkey instead/ }),
    ).toBeInTheDocument();
  });

  it('offers nothing of the sort when the browser has none', async () => {
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    passkeySupportedMock.mockReturnValue(false);
    serverWith(HOUSEHOLD);

    renderInAnAddress(<ProfileGate onSignedIn={vi.fn()} />);

    await arrive();
    await actor.click(screen.getByRole('button', { name: /Marques/ }));

    expect(screen.queryByRole('button', { name: /Use a passkey instead/ })).not.toBeInTheDocument();
  });

  it('lets somebody in when the passkey is accepted', async () => {
    const onSignedIn = vi.fn();
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    passkeySupportedMock.mockReturnValue(true);
    passkeyMock.mockResolvedValue({ kind: 'signedIn' });
    serverWith(HOUSEHOLD);

    renderInAnAddress(<ProfileGate onSignedIn={onSignedIn} />);

    await arrive();
    await actor.click(screen.getByRole('button', { name: /Marques/ }));
    await actor.click(screen.getByRole('button', { name: /Use a passkey instead/ }));

    await waitFor(() => {
      expect(onSignedIn).toHaveBeenCalled();
    });
  });

  it('says what went wrong when the passkey was refused', async () => {
    const actor = await askedForAPassword();

    passkeyMock.mockResolvedValue({ kind: 'failed', reason: 'That key is not for this account.' });

    await actor.click(screen.getByRole('button', { name: /Use a passkey instead/ }));

    expect(await screen.findByText('That key is not for this account.')).toBeInTheDocument();
  });

  it('says nothing at all when somebody changed their mind', async () => {
    const onSignedIn = vi.fn();
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    passkeySupportedMock.mockReturnValue(true);
    passkeyMock.mockResolvedValue({ kind: 'cancelled' });
    serverWith(HOUSEHOLD);

    renderInAnAddress(<ProfileGate onSignedIn={onSignedIn} />);

    await arrive();
    await actor.click(screen.getByRole('button', { name: /Marques/ }));
    await actor.click(screen.getByRole('button', { name: /Use a passkey instead/ }));

    await waitFor(() => {
      expect(passkeyMock).toHaveBeenCalled();
    });

    expect(onSignedIn).not.toHaveBeenCalled();
  });
});

describe('shown inside the desktop client', () => {
  it('offers a different server, which is the one thing a window can do and a browser cannot', async () => {
    document.documentElement.dataset['fluxDesktop'] = 'true';

    renderInAnAddress(<ProfileGate onSignedIn={vi.fn()} />);
    await arrive();

    expect(screen.getByRole('button', { name: 'Use a different server' })).toBeInTheDocument();

    delete document.documentElement.dataset['fluxDesktop'];
  });

  it('asks the window when it is chosen', async () => {
    const heard = vi.fn();
    document.documentElement.dataset['fluxDesktop'] = 'true';
    document.addEventListener('flux:change-server', heard);

    renderInAnAddress(<ProfileGate onSignedIn={vi.fn()} />);
    await arrive();
    await userEvent.click(screen.getByRole('button', { name: 'Use a different server' }));

    expect(heard).toHaveBeenCalledOnce();

    document.removeEventListener('flux:change-server', heard);
    delete document.documentElement.dataset['fluxDesktop'];
  });

  it('offers nothing of the sort in a browser, which is already where it was opened', async () => {
    renderInAnAddress(<ProfileGate onSignedIn={vi.fn()} />);
    await arrive();

    expect(screen.queryByRole('button', { name: 'Use a different server' })).toBeNull();
  });
});
