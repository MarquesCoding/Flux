import { memoryAdapter } from 'better-auth/adapters/memory'
import AuthModule from './Auth'
import type { FluxAuth } from './Auth'
import EnvModule from '@FluxServer/env/Env'
import type { Env } from '@FluxServer/env/Env'

const { createAuth } = AuthModule
const { readEnv } = EnvModule

const TEST_SECRET = 'flux-test-secret-value-at-least-32-chars'

const emptyStore = () => ({
  user: [],
  session: [],
  account: [],
  verification: [],
  twoFactor: [],
  passkey: [],
  deviceCode: [],
  jwks: [],
  apikey: [],
})

/**
 * Builds an in-memory authentication layer.
 *
 * Used by tests so that the suite never requires a running Postgres. The
 * configuration is otherwise identical to production, so cookie and origin
 * behaviour is exercised rather than stubbed.
 */
const createMemoryAuth = (overrides: Partial<NodeJS.ProcessEnv> = {}): FluxAuth => {
  const env: Env = readEnv({
    BETTER_AUTH_SECRET: TEST_SECRET,
    BETTER_AUTH_URL: 'http://localhost:8420',
    TRUSTED_ORIGINS: 'http://localhost:8420,http://localhost:5173',
    AUTH_RATE_LIMIT_ENABLED: 'false',
    ...overrides,
  })

  return createAuth({ env, database: memoryAdapter(emptyStore()) })
}

export default { createMemoryAuth, TEST_SECRET }
