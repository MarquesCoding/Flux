import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forgetPlatform, installPlatform } from '@FluxClient/platform/installPlatform';
import { aFakePlatform } from '@FluxClient/testing/aFakePlatform';
import { SignInThroughYourBrowser } from './SignInThroughYourBrowser';
import type { SignInElsewhere } from '@FluxClient/platform/Platform.types';

const start = vi.fn(() => Promise.resolve());

let announce: (() => void) | null = null;

const stopListening = vi.fn();

const aClientThatSignsInElsewhere = (): SignInElsewhere => ({
  start,
  whenDone: (then) => {
    announce = then;

    return stopListening;
  },
});

const showing = (signInElsewhere: SignInElsewhere | null, onSignedIn = vi.fn()) => {
  forgetPlatform();
  installPlatform({ ...aFakePlatform(), signInElsewhere });

  return {
    onSignedIn,
    ...render(<SignInThroughYourBrowser onSignedIn={onSignedIn} onChangeServer={vi.fn()} />),
  };
};

beforeEach(() => {
  start.mockClear();
  stopListening.mockClear();
  announce = null;
});

afterEach(() => {
  forgetPlatform();
});

describe('SignInThroughYourBrowser', () => {
  it('offers to open the browser, since that is where signing in works', () => {
    showing(aClientThatSignsInElsewhere());

    expect(screen.getByRole('button', { name: 'Open my browser' })).toBeInTheDocument();
  });

  it('opens it when asked', async () => {
    showing(aClientThatSignsInElsewhere());

    await userEvent.click(screen.getByRole('button', { name: 'Open my browser' }));

    expect(start).toHaveBeenCalledOnce();
  });

  it('waits rather than carrying on, since opening a browser is not signing in', async () => {
    const { onSignedIn } = showing(aClientThatSignsInElsewhere());

    await userEvent.click(screen.getByRole('button', { name: 'Open my browser' }));

    expect(onSignedIn).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Waiting for your browser/ })).toBeDisabled();
  });

  it('carries on once the account has actually arrived', async () => {
    const { onSignedIn } = showing(aClientThatSignsInElsewhere());

    await userEvent.click(screen.getByRole('button', { name: 'Open my browser' }));
    announce?.();

    expect(onSignedIn).toHaveBeenCalledOnce();
  });

  it('stops listening when it goes, so a signed-in window is not told twice', () => {
    const { unmount } = showing(aClientThatSignsInElsewhere());

    unmount();

    expect(stopListening).toHaveBeenCalledOnce();
  });

  it('lets somebody pick a different Flux, for an address typed wrong', async () => {
    const onChangeServer = vi.fn();

    forgetPlatform();
    installPlatform({ ...aFakePlatform(), signInElsewhere: aClientThatSignsInElsewhere() });
    render(<SignInThroughYourBrowser onSignedIn={vi.fn()} onChangeServer={onChangeServer} />);

    await userEvent.click(screen.getByRole('button', { name: 'Use a different server' }));

    expect(onChangeServer).toHaveBeenCalledOnce();
  });

  it('draws nothing in a browser, which signs somebody in where they already are', () => {
    const { container } = showing(null);

    expect(container).toBeEmptyDOMElement();
  });
});
