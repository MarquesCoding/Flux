import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetPlatform, installPlatform } from '@ValenceClient/platform/installPlatform';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';
import { readCurrentProfile, writeCurrentProfile } from '@ValenceClient/profiles/currentProfile';
import {
  authenticateWithPasskey,
  deletePasskey,
  disableTwoFactor,
  enableTwoFactor,
  fetchSession,
  listPasskeys,
  registerPasskey,
  renamePasskey,
  signOut,
  verifyBackupCode,
  verifyTotp,
} from './auth';

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

const AN_ACCOUNT = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Operator',
  email: 'operator@flux.test',
  emailVerified: true,
  image: null,
  role: 'admin',
  twoFactorEnabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const A_PASSKEY = {
  id: 'passkey-1',
  name: 'Laptop',
  deviceType: 'singleDevice',
  backedUp: false,
  createdAt: '2026-08-10T00:00:00.000Z',
  publicKey: 'x',
  userId: AN_ACCOUNT.id,
  credentialID: 'x',
  counter: 0,
  transports: 'internal',
};

const said = (body: object | null, status = 200) =>
  new Response(body === null ? 'null' : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * The path of whatever was asked for, since the client asks for an absolute address and the test
 * cares which endpoint it was.
 */
const asked = (at = 0): string =>
  new URL(String(fetchMock.mock.calls[at]?.[0] ?? '/'), 'http://localhost:3000').pathname;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  installPlatform(aFakePlatform());
});

afterEach(() => {
  forgetPlatform();
  vi.unstubAllGlobals();
});

describe('fetchSession', () => {
  it('reads who is signed in, through better-auth rather than a hand-written request', async () => {
    fetchMock.mockResolvedValue(said({ user: AN_ACCOUNT, session: { id: 'session-1' } }));

    await expect(fetchSession()).resolves.toMatchObject({
      id: AN_ACCOUNT.id,
      name: 'Operator',
      role: 'admin',
      twoFactorEnabled: true,
    });

    expect(asked()).toBe('/api/auth/get-session');
  });

  it('answers with nobody where nobody is signed in', async () => {
    fetchMock.mockResolvedValue(said(null));

    await expect(fetchSession()).resolves.toBeNull();
  });

  it('refuses to answer at all where the server could not be reached', async () => {
    fetchMock.mockResolvedValue(said({}, 500));

    await expect(fetchSession()).rejects.toThrow(/500/);
  });
});

describe('signOut', () => {
  it('ends the session where it was issued', async () => {
    fetchMock.mockResolvedValue(said({ success: true }));

    await expect(signOut()).resolves.toBe(true);

    expect(asked()).toBe('/api/auth/sign-out');
  });

  it('says what it is sending and sends it, since a body-less post is refused outright', async () => {
    fetchMock.mockResolvedValue(said({ success: true }));

    await signOut();

    const sent = fetchMock.mock.calls[0]?.[1];

    expect(new Headers(sent?.headers).get('content-type')).toBe('application/json');
    expect(sent?.body).toBe('{}');
  });

  it('forgets which face this device was watching as', async () => {
    writeCurrentProfile('somebody');
    fetchMock.mockResolvedValue(said({ success: true }));

    await signOut();

    expect(readCurrentProfile()).toBeNull();
  });

  it('says so when the server would not end it', async () => {
    fetchMock.mockResolvedValue(said({}, 500));

    await expect(signOut()).resolves.toBe(false);
  });

  it('believes the server rather than a second opinion about the same answer', async () => {
    fetchMock.mockResolvedValue(said({ success: true }));

    await expect(signOut()).resolves.toBe(true);
  });

  it('forgets the face even where the server refused, since somebody still walked away', async () => {
    writeCurrentProfile('somebody');
    fetchMock.mockResolvedValue(said({}, 500));

    await signOut();

    expect(readCurrentProfile()).toBeNull();
  });
});

describe('passkeys', () => {
  it('lists them with the times written as text rather than as dates', async () => {
    fetchMock.mockResolvedValue(said([A_PASSKEY]));

    await expect(listPasskeys()).resolves.toEqual([
      {
        id: 'passkey-1',
        name: 'Laptop',
        deviceType: 'singleDevice',
        backedUp: false,
        createdAt: '2026-08-10T00:00:00.000Z',
      },
    ]);

    expect(asked()).toBe('/api/auth/passkey/list-user-passkeys');
  });

  it('refuses to answer with a half-list where the server refused', async () => {
    fetchMock.mockResolvedValue(said({}, 500));

    await expect(listPasskeys()).rejects.toThrow(/500/);
  });

  it('removes one, and renames one', async () => {
    fetchMock.mockResolvedValue(said({ status: true }));

    await expect(deletePasskey('passkey-1')).resolves.toBe(true);
    expect(asked()).toBe('/api/auth/passkey/delete-passkey');

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(said({ status: true }));

    await expect(renamePasskey('passkey-1', 'Phone')).resolves.toBe(true);
    expect(asked()).toBe('/api/auth/passkey/update-passkey');
  });

  it('says so when the server would not remove or rename one', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(said({}, 500)));

    await expect(deletePasskey('passkey-1')).resolves.toBe(false);
    await expect(renamePasskey('passkey-1', 'Phone')).resolves.toBe(false);
  });

  it('takes a refused registration for an answer rather than throwing', async () => {
    fetchMock.mockResolvedValue(said({}, 500));

    await expect(registerPasskey('Laptop')).resolves.toMatchObject({ kind: 'failed' });
  });

  it('takes a refused sign-in for an answer rather than throwing', async () => {
    fetchMock.mockResolvedValue(said({}, 500));

    await expect(authenticateWithPasskey()).resolves.toMatchObject({ kind: 'failed' });
  });

  it('says the server could not be reached rather than throwing at the caller', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(authenticateWithPasskey()).resolves.toMatchObject({ kind: 'failed' });
    await expect(registerPasskey('Laptop')).resolves.toMatchObject({ kind: 'failed' });
  });

  it('says nothing at all when the ceremony was called off', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(said({ challenge: 'abc', rpId: 'localhost' })),
    );

    await expect(authenticateWithPasskey()).resolves.toEqual({ kind: 'cancelled' });
  });
});

describe('two-factor', () => {
  it('starts enrolment, and hands back the secret and the backup codes', async () => {
    fetchMock.mockResolvedValue(
      said({ method: 'totp', totpURI: 'otpauth://totp/Flux', backupCodes: ['aaaa-1111'] }),
    );

    await expect(enableTwoFactor('a-long-enough-password')).resolves.toEqual({
      totpURI: 'otpauth://totp/Flux',
      backupCodes: ['aaaa-1111'],
    });

    expect(asked()).toBe('/api/auth/two-factor/enable');
  });

  it('hands back nothing where the server enrolled a code by mail, which Valence does not offer', async () => {
    fetchMock.mockResolvedValue(said({ method: 'otp' }));

    await expect(enableTwoFactor('a-long-enough-password')).resolves.toBeNull();
  });

  it('hands back nothing where the password was wrong', async () => {
    fetchMock.mockResolvedValue(said({}, 401));

    await expect(enableTwoFactor('wrong')).resolves.toBeNull();
  });

  it('checks a code from an authenticator, and one of the backup codes', async () => {
    fetchMock.mockResolvedValue(said({ status: true }));

    await expect(verifyTotp('123456')).resolves.toBe(true);
    expect(asked()).toBe('/api/auth/two-factor/verify-totp');

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(said({ status: true }));

    await expect(verifyBackupCode('aaaa-1111')).resolves.toBe(true);
    expect(asked()).toBe('/api/auth/two-factor/verify-backup-code');
  });

  it('says so when a code was not accepted', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(said({}, 401)));

    await expect(verifyTotp('123456')).resolves.toBe(false);
    await expect(verifyBackupCode('aaaa-1111')).resolves.toBe(false);
  });

  it('turns it off, and says so when the password was wrong', async () => {
    fetchMock.mockResolvedValue(said({ status: true }));

    await expect(disableTwoFactor('a-long-enough-password')).resolves.toBe(true);
    expect(asked()).toBe('/api/auth/two-factor/disable');

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(said({}, 401));

    await expect(disableTwoFactor('wrong')).resolves.toBe(false);
  });
});
