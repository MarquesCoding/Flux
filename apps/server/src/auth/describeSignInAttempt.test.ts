import { describe, expect, it } from 'vitest';
import { describeSignInAttempt } from './describeSignInAttempt';
import type { SignInAttempt } from './describeSignInAttempt';

const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0 Safari/537.36';

const attempted = (attempt: Partial<SignInAttempt>): SignInAttempt => ({
  path: '/sign-in/email',
  statusCode: null,
  account: null,
  identifier: 'ada@example.com',
  userAgent: CHROME,
  address: '203.0.113.7',
  ...attempt,
});

describe('describeSignInAttempt', () => {
  it('reports somebody signing in, with the device they used', () => {
    const occurrence = describeSignInAttempt(
      attempted({ account: { id: 'account-1', name: 'Ada' } }),
    );

    expect(occurrence).toStrictEqual({
      event: 'auth.succeeded',
      data: {
        accountId: 'account-1',
        name: 'Ada',
        deviceLabel: 'Chrome on macOS',
        address: '203.0.113.7',
      },
    });
  });

  it('reports a refusal against the identifier that was tried', () => {
    const occurrence = describeSignInAttempt(attempted({ statusCode: 401 }));

    expect(occurrence?.event).toBe('auth.failed');
    expect(occurrence?.data).toMatchObject({ identifier: 'ada@example.com' });
  });

  it('says the same thing about a wrong password as about an account that does not exist', () => {
    const wrongPassword = describeSignInAttempt(attempted({ statusCode: 401 }));
    const noSuchAccount = describeSignInAttempt(
      attempted({ statusCode: 401, identifier: 'nobody@example.com' }),
    );

    expect(wrongPassword?.data).toMatchObject({ reason: 'those details were not accepted.' });
    expect(noSuchAccount?.data).toMatchObject({ reason: 'those details were not accepted.' });
  });

  it('says nothing about a request that was not a sign-in', () => {
    expect(describeSignInAttempt(attempted({ path: '/sign-out', statusCode: 401 }))).toBeNull();
  });

  it('says nothing about a sign-in that neither succeeded nor was refused', () => {
    expect(describeSignInAttempt(attempted({ statusCode: null, account: null }))).toBeNull();
  });

  it('reports a sign-in through any of the ways in, not only by password', () => {
    const occurrence = describeSignInAttempt(
      attempted({ path: '/sign-in/passkey', account: { id: 'account-1', name: 'Ada' } }),
    );

    expect(occurrence?.event).toBe('auth.succeeded');
  });

  it('names an unknown device rather than printing nothing', () => {
    const occurrence = describeSignInAttempt(attempted({ statusCode: 401, userAgent: null }));

    expect(occurrence?.data).toMatchObject({ deviceLabel: 'Unknown device' });
  });

  it('carries no address where the server could not work one out', () => {
    const occurrence = describeSignInAttempt(attempted({ statusCode: 401, address: null }));

    expect(occurrence?.data).toMatchObject({ address: null });
  });

  it('still reports a refusal that gave no identifier at all', () => {
    const occurrence = describeSignInAttempt(attempted({ statusCode: 401, identifier: null }));

    expect(occurrence?.event).toBe('auth.failed');
    expect(occurrence?.data).toMatchObject({ identifier: 'somebody who gave no address' });
  });
});
