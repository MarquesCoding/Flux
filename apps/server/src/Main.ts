import { serve } from '@hono/node-server'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import AppModule from './App'
import AuthModule from '@FluxServer/auth/Auth'
import DatabaseModule from '@FluxServer/db/Database'
import EnvModule from '@FluxServer/env/Env'

const { createApp } = AppModule
const { createAuth } = AuthModule
const { createDatabase } = DatabaseModule
const { readEnv } = EnvModule

const env = readEnv(process.env)
const { db, schema } = createDatabase(env.DATABASE_URL)

const auth = createAuth({
  env,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
})

const app = createApp({ auth })

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  const origin = `http://localhost:${info.port.toString()}`

  process.stdout.write(`Flux listening on ${origin}\n`)
  process.stdout.write(`API reference at ${origin}/api/reference\n`)
})
