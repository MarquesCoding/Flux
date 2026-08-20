const CLIENT_ID = 'client_id';

const CODE_CHALLENGE = 'code_challenge';

const STATE = 'state';

type Handover = { client_id: string; code_challenge: string; state: string };

/**
 * Picks out the three things a desktop client sends somebody to a browser with.
 *
 * A desktop client cannot sign anybody in itself, so it opens a browser on the server's own pages
 * carrying who is asking and a challenge only it can answer. Signing in there is what mints the code
 * that gets somebody back, and the server only mints one where all three arrived together — so they
 * have to survive the journey from the address bar to the request that actually signs somebody in.
 *
 * Anything else in the address is ignored. Two of three is not a handover, it is a query string with
 * something missing, and half a handover would leave somebody signed in to a browser wondering why
 * their application never came back.
 *
 * @param asked - The query the page was opened with.
 * @returns The three, or nothing where this is not a desktop client's sign-in.
 */
const electronHandover = (asked: Record<string, string | undefined>): Handover | null => {
  const clientId = asked[CLIENT_ID];
  const challenge = asked[CODE_CHALLENGE];
  const state = asked[STATE];

  if (
    clientId === undefined ||
    clientId === '' ||
    challenge === undefined ||
    challenge === '' ||
    state === undefined ||
    state === ''
  ) {
    return null;
  }

  return { client_id: clientId, code_challenge: challenge, state };
};

export type { Handover };

export { electronHandover };
