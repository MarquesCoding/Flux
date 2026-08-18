import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPasskeySupported, describePasskeyUnavailability } from './isPasskeySupported';

const setContext = (options: { secure: boolean; hasCredential: boolean }) => {
  vi.stubGlobal('window', {
    isSecureContext: options.secure,
    PublicKeyCredential: options.hasCredential ? function PublicKeyCredential() {} : undefined,
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isPasskeySupported', () => {
  it('is supported in a secure context with webauthn', () => {
    setContext({ secure: true, hasCredential: true });

    expect(isPasskeySupported()).toBe(true);
  });

  it('is unsupported over plain http', () => {
    setContext({ secure: false, hasCredential: true });

    expect(isPasskeySupported()).toBe(false);
  });

  it('is unsupported when the browser lacks webauthn', () => {
    setContext({ secure: true, hasCredential: false });

    expect(isPasskeySupported()).toBe(false);
  });
});

describe('describePasskeyUnavailability', () => {
  it('says nothing when passkeys work', () => {
    setContext({ secure: true, hasCredential: true });

    expect(describePasskeyUnavailability()).toBeNull();
  });

  it('explains the secure context requirement, naming https and localhost', () => {
    setContext({ secure: false, hasCredential: true });

    expect(describePasskeyUnavailability()).toMatch(/HTTPS.*localhost/);
  });

  it('explains an unsupported browser', () => {
    setContext({ secure: true, hasCredential: false });

    expect(describePasskeyUnavailability()).toMatch(/does not support passkeys/);
  });
});
