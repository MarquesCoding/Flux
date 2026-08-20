import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forgetPlatform, installPlatform } from '@FluxClient/platform/installPlatform';
import { aFakePlatform } from '@FluxClient/testing/aFakePlatform';
import { ThisClientsChoices } from './ThisClientsChoices';
import type { Platform } from '@FluxClient/platform/Platform.types';

const start = vi.fn(() => Promise.resolve());

const changeServer = vi.fn();

const showing = (overrides: Partial<Platform>) => {
  forgetPlatform();
  installPlatform({ ...aFakePlatform(), ...overrides });

  return render(<ThisClientsChoices />);
};

const aClientWithAWindowOfItsOwn = {
  signInElsewhere: { start, whenDone: () => () => {} },
  changeServer,
};

afterEach(() => {
  forgetPlatform();
  start.mockClear();
  changeServer.mockClear();
});

describe('ThisClientsChoices', () => {
  it('draws nothing in a browser, which has neither way out and needs neither', () => {
    const { container } = showing({});

    expect(container).toBeEmptyDOMElement();
  });

  it('offers a browser to sign in through, for what this window cannot manage alone', async () => {
    showing(aClientWithAWindowOfItsOwn);

    await userEvent.click(screen.getByRole('button', { name: 'Sign in through your browser' }));

    expect(start).toHaveBeenCalledOnce();
  });

  it('offers a different server, for an address typed wrong', async () => {
    showing(aClientWithAWindowOfItsOwn);

    await userEvent.click(screen.getByRole('button', { name: 'Use a different server' }));

    expect(changeServer).toHaveBeenCalledOnce();
  });

  it('offers only what this client actually has', () => {
    showing({ changeServer });

    expect(screen.queryByRole('button', { name: 'Sign in through your browser' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Use a different server' })).toBeInTheDocument();
  });

  it('offers signing in elsewhere without a server to change, which a fixed client would be', () => {
    showing({ signInElsewhere: { start, whenDone: () => () => {} } });

    expect(screen.getByRole('button', { name: 'Sign in through your browser' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use a different server' })).toBeNull();
  });
});
