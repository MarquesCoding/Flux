import type { ValenceAuth } from './Auth';

type Session = Awaited<ReturnType<ValenceAuth['api']['getSession']>>;

type ResolvesSessions = {
  api: { getSession: (options: { headers: Headers }) => Promise<Session> };
};

const answered = new WeakMap<Headers, Promise<Session>>();

/**
 * Works out who is asking once per request rather than once per check. A single request may ask
 * about permissions several times, and each would otherwise be a round trip to the session store.
 *
 * @param auth - The authentication layer that resolves sessions.
 * @param headers - The request's headers, which also serve as the key for the request.
 * @returns Who is asking, or null where nobody is signed in.
 */
const readSessionOnce = (auth: ResolvesSessions, headers: Headers): Promise<Session> => {
  const asked = answered.get(headers);

  if (asked !== undefined) {
    return asked;
  }

  const answering = auth.api.getSession({ headers }).catch(() => null);

  answered.set(headers, answering);

  return answering;
};

export type { ResolvesSessions };

export { readSessionOnce };
