import { describe, expect, it, vi } from 'vitest'
import AppModule from '@FluxServer/App'
import createMemoryAuthModule from '@FluxServer/auth/createMemoryAuth'
import createMemoryLibraryServiceModule from '@FluxServer/library/createMemoryLibraryService'

const { createApp } = AppModule
const { createMemoryAuth } = createMemoryAuthModule
const { createMemoryLibraryService } = createMemoryLibraryServiceModule

const adminPayload = {
  admin: { name: 'Operator', email: 'admin@flux.test', password: 'a-long-enough-password' },
  trustedOrigins: ['http://192.168.1.40:8420'],
  cookieSecure: false,
}

const buildApp = (initialUserCount = 0) => {
  const { auth, settings } = createMemoryAuth()
  const state = { users: initialUserCount }
  const promoteToAdmin = vi.fn(() => Promise.resolve())

  const app = createApp({
    auth,
    settings,
    countUsers: () => Promise.resolve(state.users),
    promoteToAdmin,
    library: createMemoryLibraryService(),
  })

  return { app, settings, state, promoteToAdmin }
}

const postSetup = (body: object, url = 'http://localhost:8420/api/setup') =>
  new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('setup status', () => {
  it('reports incomplete when no user exists', async () => {
    const { app } = buildApp(0)

    const response = await app.request('http://localhost:8420/api/setup/status')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ isComplete: false })
  })

  it('reports complete once a user exists', async () => {
    const { app } = buildApp(1)

    const response = await app.request('http://localhost:8420/api/setup/status')

    expect(await response.json()).toMatchObject({ isComplete: true })
  })

  it('detects the origin from the request rather than from configuration', async () => {
    const { app } = buildApp(0)

    const response = await app.request('http://192.168.1.40:8420/api/setup/status')

    expect(await response.json()).toMatchObject({
      detectedOrigin: 'http://192.168.1.40:8420',
      isSecureContext: false,
    })
  })

  it('reports a secure context when reached over https', async () => {
    const { app } = buildApp(0)

    const response = await app.request('https://flux.example/api/setup/status')

    expect(await response.json()).toMatchObject({ isSecureContext: true })
  })

  it('suggests the detected origin and the development client', async () => {
    const { app } = buildApp(0)

    const response = await app.request('http://192.168.1.40:8420/api/setup/status')
    const body = await response.json()

    expect(body).toMatchObject({
      suggestedTrustedOrigins: ['http://192.168.1.40:8420', 'http://192.168.1.40:5173'],
    })
  })
})

describe('setup completion', () => {
  it('creates the administrator and stores the configuration', async () => {
    const { app, settings, promoteToAdmin } = buildApp(0)

    const response = await app.request(postSetup(adminPayload))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ isComplete: true })
    expect(promoteToAdmin).toHaveBeenCalledWith('admin@flux.test')
    expect(await settings.read()).toMatchObject({
      trustedOrigins: ['http://192.168.1.40:8420'],
      cookieSecure: false,
    })
  })

  it('records when setup was completed', async () => {
    const { app, settings } = buildApp(0)

    await app.request(postSetup(adminPayload))

    expect((await settings.read()).setupCompletedAt).not.toBeNull()
  })

  it('refuses once any user already exists', async () => {
    const { app, promoteToAdmin } = buildApp(1)

    const response = await app.request(postSetup(adminPayload))

    expect(response.status).toBe(409)
    expect(promoteToAdmin).not.toHaveBeenCalled()
  })

  it('cannot be replayed to claim a second administrator', async () => {
    const { app, state } = buildApp(0)

    const first = await app.request(postSetup(adminPayload))
    state.users = 1

    const second = await app.request(
      postSetup({ ...adminPayload, admin: { ...adminPayload.admin, email: 'attacker@flux.test' } }),
    )

    expect(first.status).toBe(200)
    expect(second.status).toBe(409)
  })

  it('reports that a restart is required when the cookie mode changes', async () => {
    const { app } = buildApp(0)

    const response = await app.request(postSetup({ ...adminPayload, cookieSecure: true }))

    expect(await response.json()).toMatchObject({ restartRequired: true })
  })

  it('reports no restart when the cookie mode is unchanged', async () => {
    const { app } = buildApp(0)

    const response = await app.request(postSetup(adminPayload))

    expect(await response.json()).toMatchObject({ restartRequired: false })
  })

  it('rejects a password below the minimum length', async () => {
    const { app } = buildApp(0)

    const response = await app.request(
      postSetup({ ...adminPayload, admin: { ...adminPayload.admin, password: 'short' } }),
    )

    expect(response.status).toBe(400)
  })

  it('rejects an empty trusted origin list', async () => {
    const { app } = buildApp(0)

    const response = await app.request(postSetup({ ...adminPayload, trustedOrigins: [] }))

    expect(response.status).toBe(400)
  })

  it('rejects a trusted origin that is not a url', async () => {
    const { app } = buildApp(0)

    const response = await app.request(
      postSetup({ ...adminPayload, trustedOrigins: ['not-a-url'] }),
    )

    expect(response.status).toBe(400)
  })
})

describe('settings applied after setup', () => {
  it('makes the newly trusted origin usable without a restart', async () => {
    const { app, settings } = buildApp(0)

    await app.request(postSetup(adminPayload))

    expect((await settings.read()).trustedOrigins).toContain('http://192.168.1.40:8420')
  })
})
