import { afterEach, describe, expect, it, vi } from 'vitest';
import { signInThroughABrowser } from './signInThroughABrowser';

const requestAuth = vi.fn(() => Promise.resolve());

const stopListening = vi.fn();

const onAuthenticated = vi.fn((then: () => void) => {
  announce = then;

  return stopListening;
});

let announce: (() => void) | null = null;

const aWindowWithABridge = (): void => {
  announce = null;
  requestAuth.mockClear();
  stopListening.mockClear();
  onAuthenticated.mockClear();
  vi.stubGlobal('requestAuth', requestAuth);
  vi.stubGlobal('onAuthenticated', onAuthenticated);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('signInThroughABrowser', () => {
  it('opens the browser, which is where signing in actually works', async () => {
    aWindowWithABridge();

    await signInThroughABrowser().start();

    expect(requestAuth).toHaveBeenCalledOnce();
  });

  it('passes on the account arriving, which is what the screen waits for', () => {
    aWindowWithABridge();

    const told = vi.fn();
    signInThroughABrowser().whenDone(told);

    announce?.();

    expect(told).toHaveBeenCalledOnce();
  });

  it('hands back the way to stop listening, so a screen that goes stops being told', () => {
    aWindowWithABridge();

    signInThroughABrowser().whenDone(vi.fn())();

    expect(stopListening).toHaveBeenCalledOnce();
  });

  it('tells the screen nothing about the account, which it has no business knowing', () => {
    aWindowWithABridge();

    const told = vi.fn();
    signInThroughABrowser().whenDone(told);

    announce?.();

    expect(told).toHaveBeenCalledWith();
  });
});
