type RequestableApp = {
  request: (input: string | Request, init?: RequestInit) => Response | Promise<Response>;
};

type MemoryUserStore = {
  user: { id: string; role?: string }[];
};

type RoleGranting = {
  listRoles: () => Promise<{ id: string; name: string }[]>;
  assignRole: (userId: string, roleId: string) => Promise<void>;
};

const TEST_ORIGIN = 'http://localhost:8420';

const TEST_CREDENTIALS = {
  name: 'Marques',
  email: 'marques@flux.local',
  password: 'a-long-enough-password',
};

/**
 * Signs an account up and answers the cookie that keeps it signed in.
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
 * @param app The application under test.
 * @param options `store` and `isAdministrator` together promote the account, for the routes that ask for more than merely being signed in.
 */
const signedInApp = (
  app: RequestableApp,
  options: {
    store?: MemoryUserStore;
    permissions?: RoleGranting;
    isAdministrator?: boolean;
  } = {},
): RequestableApp => {
  let cookie: string | null = null;

  return {
    request: async (input: string | Request, init: RequestInit = {}) => {
      if (cookie === null) {
        cookie = await signUpForTest(app);

        const account = options.store?.user[0];

        if (options.isAdministrator === true && account !== undefined) {
          account.role = 'admin';

          await makeAdministrator(options.permissions, account.id);
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

/**
 * Gives an account the Administrator role.
 */
const makeAdministrator = async (
  permissions: RoleGranting | undefined,
  userId: string,
): Promise<void> => {
  if (permissions === undefined) {
    return;
  }

  const administrator = (await permissions.listRoles()).find(
    (candidate) => candidate.name === 'Administrator',
  );

  if (administrator !== undefined) {
    await permissions.assignRole(userId, administrator.id);
  }
};

export { signUpForTest, signedInApp, makeAdministrator, TEST_CREDENTIALS, TEST_ORIGIN };
