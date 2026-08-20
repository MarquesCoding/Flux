import type { Handover } from '@FluxCore/functions/electronHandover';
import { askTheServer } from '@FluxClient/session/askTheServer';
import { readFromServer } from '@FluxClient/query/readFromServer';
import { z } from 'zod';
import { ViewerProfileListSchema } from '@FluxContracts/schemas/ViewerProfile';
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';

const TwoFactorPendingSchema = z.object({ twoFactorRedirect: z.literal(true) });

/**
 * Everybody who could sign in on this server, which is what the way-in screen shows before anybody
 * has. Names and faces only — enough to be picked from, and nothing that says anything about the
 * accounts behind them.
 */
const fetchEveryone = async (): Promise<ViewerProfile[]> => {
  return (await readFromServer('/api/profiles/everyone', ViewerProfileListSchema)).profiles;
};

/**
 * Signs somebody in by the face they picked, for a household where the television is already signed
 * in to the account and choosing a profile is the whole of the ceremony.
 *
 * The one request to do with signing in that does not go through better-auth's client, and
 * deliberately so. It is not a second way of getting a session: the route it calls looks up the
 * address behind the face and hands it to `auth.api.signInEmail`, so better-auth issues this session
 * as it issues every other. What the route buys is that the address never reaches the browser —
 * picking a face is the whole point of a wall of faces, and typing an email is not picking a face.
 *
 * Making it a better-auth plugin instead would move the same lookup and the same call behind the
 * library's surface, and put a Flux idea — a household with profiles — into a library that has no
 * opinion about them. So it stays here, as the exception, named.
 *
 * It is asked through `askTheServer` all the same, because the route answers exactly as better-auth
 * does, and because it carries what a desktop client sent somebody here with.
 *
 * That last part is why the address this page was opened at matters. A desktop client cannot sign
 * anybody in, so it opens a browser here with who is asking and a challenge only it can answer. The
 * server mints the code that gets somebody back at the moment a session is made, and only where all
 * three arrived with the request that made it — so they are carried from the address bar onto this
 * request rather than left behind on the page.
 *
 * The handover is passed in rather than read here, because it comes off the address bar and this
 * package does not have one — it is the application rather than a page in it.
 *
 * @param profileId - Who picked.
 * @param password - Their PIN, where the profile has one.
 * @param carried - What a desktop client sent somebody here with, where one did.
 * @returns Whether it worked, and why not where it did not.
 */
const signInAsProfile = async (
  profileId: string,
  password: string,
  carried: Handover | null = null,
): Promise<{ kind: 'signedIn' } | { kind: 'needsCode' } | { kind: 'refused'; reason: string }> => {
  const asked =
    carried === null
      ? `/api/profiles/${profileId}/sign-in`
      : `/api/profiles/${profileId}/sign-in?${new URLSearchParams(carried).toString()}`;

  const response = await askTheServer(asked, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  }).catch(() => null);

  if (response === null) {
    return { kind: 'refused', reason: 'Flux could not be reached.' };
  }

  if (!response.ok) {
    return { kind: 'refused', reason: 'That password is not right.' };
  }

  const body = await response.text().catch(() => '');

  return TwoFactorPendingSchema.safeParse(JSON.parse(body === '' ? 'null' : body)).success
    ? { kind: 'needsCode' }
    : { kind: 'signedIn' };
};

export { fetchEveryone, signInAsProfile };
