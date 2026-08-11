/**
 * Enough of the application for a test to make a request against it.
 *
 * Structural rather than the concrete app type, so that this helper does not
 * pull the whole of `createApp` into every suite that only wants a cookie.
 */
type RequestableApp = {
  request: (input: string | Request, init?: RequestInit) => Response | Promise<Response>;
};

/**
 * The rows behind the in-memory auth layer, as far as promotion needs them.
 */
type MemoryUserStore = {
  user: { id: string; role?: string }[];
};

/**
 * The origin the in-memory auth layer trusts, and therefore the one a test
 * has to sign up against.
 */
const TEST_ORIGIN = 'http://localhost:8420';

const TEST_CREDENTIALS = {
  name: 'Marques',
  email: 'marques@flux.local',
  password: 'a-long-enough-password',
};

/**
 * Signs an account up and answers the cookie that keeps it signed in.
 *
 * Signing up through the real endpoint rather than writing a session row
 * keeps a suite honest about how sessions are actually made.
 *
 * @param app The application under test.
 * @param credentials Who to sign up, when a suite needs more than one account.
 */
const signUpForTest = async (
  app: RequestableApp,
  credentials: { name: string; email: string; password: string } = TEST_CREDENTIALS,
): Promise<string> => {
  const response = await app.request(`${TEST_ORIGIN}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: TEST_ORIGIN },
    body: JSON.stringify(credentials),
  });

  return response.headers.getSetCookie()[0]?.split(';')[0] ?? '';
};

/**
 * The same application, with a session on every request it is given.
 *
 * Every route outside the handful `isPublicRoute` excuses now requires one,
 * so a suite exercising a route has to hold a real cookie rather than an
 * implied identity. Wrapping the app rather than threading a cookie through
 * every call keeps those suites about the route they are testing.
 *
 * Signing up happens on the first request rather than up front, so building
 * an application stays synchronous for the suites that do it inline.
 *
 * @param app The application under test.
 * @param options `store` and `isAdministrator` together promote the account,
 * for the routes that ask for more than merely being signed in.
 */
const signedInApp = (
  app: RequestableApp,
  options: { store?: MemoryUserStore; isAdministrator?: boolean } = {},
): RequestableApp => {
  let cookie: string | null = null;

  return {
    request: async (input: string | Request, init: RequestInit = {}) => {
      if (cookie === null) {
        cookie = await signUpForTest(app);

        const account = options.store?.user[0];

        if (options.isAdministrator === true && account !== undefined) {
          account.role = 'admin';
        }
      }

      if (typeof input !== 'string') {
        const carried = new Headers(input.headers);

        carried.set('cookie', cookie);

        return app.request(new Request(input, { headers: carried }));
      }

      const headers = new Headers(init.headers);

      headers.set('cookie', cookie);

      return app.request(input, { ...init, headers });
    },
  };
};

export { signUpForTest, signedInApp, TEST_CREDENTIALS, TEST_ORIGIN };
