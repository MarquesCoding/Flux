import type { FluxAuth } from './Auth';

type Session = Awaited<ReturnType<FluxAuth['api']['getSession']>>;

type ResolvesSessions = {
  api: { getSession: (options: { headers: Headers }) => Promise<Session> };
};

const answered = new WeakMap<Headers, Promise<Session>>();

/**
 * Who is asking, worked out once per request.
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
