import { z } from 'zod';
import { createAuthClient } from 'better-auth/client';
import { serverUrl } from '@FluxClient/query/serverUrl';
import { authorisation, rememberSessionToken } from '@FluxClient/session/sessionToken';
import { adminClient, twoFactorClient } from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';
import { writeCurrentProfile } from '@FluxClient/profiles/currentProfile';
import type { SessionUser } from '@FluxContracts/schemas/Session';
import type { Passkey } from '@FluxContracts/schemas/Passkey';

type RegisterOutcome =
  { kind: 'registered' } | { kind: 'cancelled' } | { kind: 'failed'; reason: string };

type AuthenticateOutcome =
  { kind: 'signedIn' } | { kind: 'cancelled' } | { kind: 'failed'; reason: string };

type Enrollment = { totpURI: string; backupCodes: string[] };

const CANCELLED = new Set(['AUTH_CANCELLED', 'ERROR_CEREMONY_ABORTED']);

const PLACEHOLDER_ORIGIN = 'http://flux.invalid';

const onTheServer = (asked: string): string => {
  const { pathname, search } = new URL(asked, PLACEHOLDER_ORIGIN);

  return serverUrl(`${pathname}${search}`);
};

/**
 * Sends what better-auth asked for to the server this client watches, carrying whatever says who it
 * is and keeping any token that comes back.
 *
 * A browser is recognised by its cookie and this adds nothing. A client whose window serves its own
 * pages cannot be sent that cookie, so it presents the token instead and holds the one every
 * signing-in response hands back — see ADR-0026.
 *
 * The client is built against an origin that does not exist, and every request is moved onto the one
 * this client actually watches. That is what lets somebody change which server they are watching
 * without the client being rebuilt, which a desktop client does on the screen it opens with.
 *
 * A header the caller already set is left alone, since it knows something this does not.
 *
 * @param input - What the library asked for.
 * @param init - How it asked.
 * @returns The answer.
 */
const askTheServer = async (
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> => {
  const asked = input instanceof Request ? input.url : String(input);
  const carried = new Headers(init?.headers ?? (input instanceof Request ? input.headers : {}));

  for (const [name, value] of Object.entries(authorisation())) {
    if (!carried.has(name)) {
      carried.set(name, value);
    }
  }

  const response =
    input instanceof Request
      ? await globalThis.fetch(new Request(onTheServer(asked), input), { headers: carried })
      : await globalThis.fetch(onTheServer(asked), { ...init, headers: carried });

  const handed = response.headers.get('set-auth-token');

  if (handed !== null) {
    rememberSessionToken(handed);
  }

  return response;
};

/**
 * Builds the one client that speaks to better-auth, which this module holds and nothing else sees.
 *
 * Every request to `/api/auth` goes through it rather than being written out as a `fetch` with a
 * hand-written schema beside it. The library types its own protocol, so an endpoint or a payload
 * that changes underneath us stops the build rather than a passkey ceremony in production.
 *
 * The vanilla client rather than the React one, because the answers belong in the shared cache with
 * everything else the server has said, not in a second store of the library's own. It is not
 * exported either, and the reason is worth knowing: the type of a client carrying three plugins is
 * longer than TypeScript will serialise across a module boundary, so what leaves this module is a
 * set of named functions with types of their own. That is the better shape anyway — a component
 * should ask for what it wants rather than reach for a client.
 *
 * The plugins are the ones the server mounts and this application calls: `admin` for the role on a
 * user, `twoFactor`, and `passkey`.
 *
 * Its `fetch` is handed over rather than left to be found, for two reasons and no others: the
 * library reads the global once when the client is built, which is before a test has had a chance
 * to stand in for it, and it asks with a `URL` where a caller may be expecting a string.
 *
 * Nothing else is done to the request. A shim here once added a content type as well, on the theory
 * that the library sent a body without naming it — it sends `{}` with `application/json` and
 * `credentials: include` of its own accord, so that was an answer to a question nobody had asked,
 * sitting on the one path where a mistake ends a session or fails to.
 *
 * The `baseURL` is an address that resolves nowhere, because there is no address to give: a browser
 * is answered by the page it was served, a desktop client by whichever Flux somebody named, and
 * neither is known when the client is built. The library needs one to join a path to, so it is given
 * a placeholder and `askTheServer` puts the path on the real server as it goes. A request that
 * escapes that rewrite fails to reach anything rather than reaching somewhere wrong.
 *
 * @returns The client.
 */
const buildClient = () =>
  createAuthClient({
    baseURL: PLACEHOLDER_ORIGIN,
    basePath: '/api/auth',
    fetchOptions: { customFetchImpl: askTheServer },
    plugins: [adminClient(), twoFactorClient(), passkeyClient()],
  });

const client = buildClient();

const CodedSchema = z.object({ code: z.string() });

/**
 * Whether a refusal was somebody changing their mind rather than something going wrong.
 *
 * The code is read through a schema because the library types its errors without one, while the
 * passkey plugin sets it — and telling a cancellation from a failure decides whether the person is
 * shown a message or nothing at all.
 *
 * @param error - What the client refused with.
 * @returns Whether it was a cancellation.
 */
const wasCancelled = (error: object): boolean => {
  const read = CodedSchema.safeParse(error);

  return read.success && CANCELLED.has(read.data.code);
};

/**
 * Reads the current session: who is signed in, what they may do, and whether they have got as far as
 * a second factor. The first thing the application asks, and what decides whether it shows the
 * library or the way in.
 *
 * Throws where the server could not be reached, rather than answering with nobody: a tab that cannot
 * reach Flux should say so, not offer the way in as though somebody had signed out.
 *
 * @returns Who is signed in, or nobody.
 */
const fetchSession = async (): Promise<SessionUser | null> => {
  const { data, error } = await client.getSession();

  if (error !== null) {
    throw new Error(`Session request failed with status ${String(error.status)}`);
  }

  if (data === null) {
    return null;
  }

  return {
    id: data.user.id,
    name: data.user.name,
    email: data.user.email,
    emailVerified: data.user.emailVerified,
    image: data.user.image,
    role: data.user.role,
    twoFactorEnabled: data.user.twoFactorEnabled,
  };
};

/**
 * Ends this session on the server, so the cookie is cleared where it was issued rather than only
 * being forgotten here, and forgets which face this device was watching as.
 *
 * The face is held on the device rather than in the session, which is what makes signing out easy to
 * get wrong: end the session alone and the next person to sign in on this television is silently
 * treated as whoever used it last, with their history and their place in everything.
 *
 * Whether it worked is read from the refusal, the way every other call in this module reads it. It
 * was once taken from the library's success hook instead, which is a second way of asking the same
 * question and the only one here that could answer no while the server had said yes.
 *
 * The face is forgotten either way, and so is any token this client was holding. A sign-out that did
 * not reach the server still means somebody walked away from this device, and leaving their face —
 * or a credential that still works — on it is the failure that matters.
 *
 * @returns Whether the session was ended.
 */
const signOut = async (): Promise<boolean> => {
  const { error } = await client.signOut();

  writeCurrentProfile(null);
  rememberSessionToken(null);

  return error === null;
};

/**
 * Runs the browser's registration ceremony and hands the result to the server, which is how a device
 * becomes something somebody can sign in with instead of a password.
 *
 * @param name - What to call this device in the list of passkeys.
 * @returns Whether it worked, and why not where it did not.
 */
const registerPasskey = async (name: string): Promise<RegisterOutcome> => {
  const answer = await client.passkey.addPasskey({ name }).catch(() => null);

  if (answer === null) {
    return { kind: 'failed', reason: 'Flux could not be reached.' };
  }

  const error = answer.error ?? null;

  if (error === null) {
    return { kind: 'registered' };
  }

  if (wasCancelled(error)) {
    return { kind: 'cancelled' };
  }

  return { kind: 'failed', reason: error.message ?? 'Your device could not create a passkey.' };
};

/**
 * Signs in with a passkey: the browser signs a challenge with whatever credential the person
 * chooses, and the result is checked by the server. The password is never involved, and nothing
 * secret leaves the device.
 *
 * @returns Whether it worked, and why not where it did not.
 */
const authenticateWithPasskey = async (): Promise<AuthenticateOutcome> => {
  const answer = await client.signIn.passkey().catch(() => null);

  if (answer === null) {
    return { kind: 'failed', reason: 'Flux could not be reached.' };
  }

  const error = answer.error ?? null;

  if (error === null) {
    return { kind: 'signedIn' };
  }

  if (wasCancelled(error)) {
    return { kind: 'cancelled' };
  }

  return { kind: 'failed', reason: error.message ?? 'That passkey was not accepted.' };
};

/**
 * Lists the passkeys enrolled on this account, with when each was last used. A passkey nobody
 * recognises is one worth removing, and last use is what makes that judgeable.
 *
 * @returns The passkeys, newest first as the server ordered them.
 */
const listPasskeys = async (): Promise<Passkey[]> => {
  const { data, error } = await client.passkey.listUserPasskeys();

  if (error !== null) {
    throw new Error(`Passkey list failed with status ${String(error.status)}`);
  }

  return data.map((passkey) => ({
    id: passkey.id,
    name: passkey.name,
    deviceType: passkey.deviceType,
    backedUp: passkey.backedUp,
    createdAt: passkey.createdAt.toISOString(),
  }));
};

/**
 * Removes a registered passkey, for somebody who has lost the device it lived on.
 *
 * @param id - The passkey to remove.
 * @returns Whether it was removed.
 */
const deletePasskey = async (id: string): Promise<boolean> => {
  const { error } = await client.passkey.deletePasskey({ id });

  return error === null;
};

/**
 * Renames a registered passkey, since a list of them is unusable when each is called the same thing.
 *
 * @param id - The passkey to rename.
 * @param name - What to call it.
 * @returns Whether it was renamed.
 */
const renamePasskey = async (id: string, name: string): Promise<boolean> => {
  const { error } = await client.passkey.updatePasskey({ id, name });

  return error === null;
};

/**
 * Starts enrolling a second factor, which the password is needed for: turning it on is a change to
 * how this account is protected, and a borrowed session should not be able to make it.
 *
 * @param password - The account's password.
 * @returns The secret to enrol against and the backup codes, or nothing where the password was wrong.
 */
const enableTwoFactor = async (password: string): Promise<Enrollment | null> => {
  const { data, error } = await client.twoFactor.enable({ password });

  return error === null ? { totpURI: data.totpURI, backupCodes: data.backupCodes } : null;
};

/**
 * Checks a code from an authenticator, which both finishes enrolment and answers the challenge at
 * sign-in.
 *
 * @param code - The six digits shown by the authenticator.
 * @returns Whether it was accepted.
 */
const verifyTotp = async (code: string): Promise<boolean> => {
  const { error } = await client.twoFactor.verifyTotp({ code });

  return error === null;
};

/**
 * Checks one of the backup codes, for somebody who has lost the device their authenticator was on.
 *
 * @param code - The backup code.
 * @returns Whether it was accepted.
 */
const verifyBackupCode = async (code: string): Promise<boolean> => {
  const { error } = await client.twoFactor.verifyBackupCode({ code });

  return error === null;
};

/**
 * Turns the second factor off, which the password is needed for, for the same reason turning it on
 * is.
 *
 * @param password - The account's password.
 * @returns Whether it was turned off.
 */
const disableTwoFactor = async (password: string): Promise<boolean> => {
  const { error } = await client.twoFactor.disable({ password });

  return error === null;
};

export type { RegisterOutcome, AuthenticateOutcome, Enrollment };

export {
  fetchSession,
  signOut,
  registerPasskey,
  authenticateWithPasskey,
  listPasskeys,
  deletePasskey,
  renamePasskey,
  enableTwoFactor,
  verifyTotp,
  verifyBackupCode,
  disableTwoFactor,
};
