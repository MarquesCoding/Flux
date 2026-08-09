import { serve } from '@hono/node-server'
import AppModule from './App'
import EnvModule from './env/Env'

const { createApp } = AppModule
const { readEnv } = EnvModule

const env = readEnv(process.env)
const app = createApp()

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  process.stdout.write(`Flux listening on http://localhost:${info.port.toString()}\n`)
  process.stdout.write(`API reference at http://localhost:${info.port.toString()}/api/reference\n`)
})
