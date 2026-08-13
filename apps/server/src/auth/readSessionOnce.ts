import type { FluxAuth } from './Auth';

type Session = Awaited<ReturnType<FluxAuth['api']['getSession']>>;

/**
 * The one thing this needs of an authentication layer.
 *
 * Named as the question rather than as the whole of better-auth, so that
 * anything able to answer it can be handed over — which is what lets the
 * counting in its test be a plain object rather than a pretend library.
 */
type ResolvesSessions = {
  api: { getSession: (options: { headers: Headers }) => Promise<Session> };
};

/**
 * The answer already given for a set of headers.
 *
 * Weak, and keyed on the request's own headers, which live exactly as long as
 * the request does. Nothing here outlives what it describes and two requests
 * can never see each other's answer.
 */
const answered = new WeakMap<Headers, Promise<Session>>();

/**
 * Who is asking, worked out once per request.
 *
 * One request asks more than once — the gate that admits it, the guard that
 * checks a permission, and a handler that wants the account are three separate
 * questions with a single answer. Asking three times was not merely wasteful.
 *
 * An API key is verified on every resolution and counted against its own rate
 * limit, so a key allowed sixty requests a minute was really allowed twenty,
 * and one near its limit started failing part-way through serving a request it
 * had already been admitted for. Measured against a real server, a route that
 * resolved three times spent a key's whole daily allowance in two calls; the
 * same route now spends one.
 *
 * Anything unreadable answers as nobody rather than throwing, which is what
 * every caller wanted from it anyway.
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
