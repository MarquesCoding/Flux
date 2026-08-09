import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SignInModule from './SignIn'
import type { JsonValue } from '@FluxContracts/schemas/JsonValue'

const { SignIn } = SignInModule

type JsonRequestInit = Omit<RequestInit, 'body'> & { body?: string }

type FetchLike = (
  input: string,
  init?: JsonRequestInit,
) => Promise<{ ok: boolean; status: number; json: () => Promise<JsonValue> }>

const fetchMock = vi.fn<FetchLike>()

const user = {
  id: 'usr_1',
  name: 'Operator',
  email: 'admin@flux.test',
  emailVerified: false,
}

const respondWith = (body: JsonValue, ok = true, status = 200) => {
  fetchMock.mockResolvedValue({ ok, status, json: () => Promise.resolve(body) })
}

beforeEach(() => {
  fetchMock.mockReset()
  respondWith({ redirect: false, token: 'abc', user })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const fill = async (actor: ReturnType<typeof userEvent.setup>) => {
  await actor.type(screen.getByLabelText('Email'), 'admin@flux.test')
  await actor.type(screen.getByLabelText('Password'), 'a-long-enough-password')
}

describe('SignIn', () => {
  it('renders an accessible sign in form', () => {
    render(<SignIn onSignedIn={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Sign in to Flux' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('masks the password field', () => {
    render(<SignIn onSignedIn={vi.fn()} />)

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
  })

  it('does not submit an invalid email', async () => {
    const actor = userEvent.setup()
    render(<SignIn onSignedIn={vi.fn()} />)

    await actor.type(screen.getByLabelText('Email'), 'nope')
    await actor.click(screen.getByRole('button', { name: /Sign in/ }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
  })

  it('does not submit an empty password', async () => {
    const actor = userEvent.setup()
    render(<SignIn onSignedIn={vi.fn()} />)

    await actor.type(screen.getByLabelText('Email'), 'admin@flux.test')
    await actor.click(screen.getByRole('button', { name: /Sign in/ }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
  })

  it('posts the credentials to better-auth', async () => {
    const actor = userEvent.setup()
    render(<SignIn onSignedIn={vi.fn()} />)

    await fill(actor)
    await actor.click(screen.getByRole('button', { name: /Sign in/ }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/sign-in/email', expect.anything())
    })
  })

  it('reports success to its parent', async () => {
    const onSignedIn = vi.fn()
    const actor = userEvent.setup()
    render(<SignIn onSignedIn={onSignedIn} />)

    await fill(actor)
    await actor.click(screen.getByRole('button', { name: /Sign in/ }))

    await waitFor(() => {
      expect(onSignedIn).toHaveBeenCalledOnce()
    })
  })

  it('submits when the form is submitted with the keyboard', async () => {
    const onSignedIn = vi.fn()
    const actor = userEvent.setup()
    render(<SignIn onSignedIn={onSignedIn} />)

    await fill(actor)
    await actor.keyboard('{Enter}')

    await waitFor(() => {
      expect(onSignedIn).toHaveBeenCalledOnce()
    })
  })

  it('does not reveal whether the email or the password was wrong', async () => {
    respondWith({ message: 'Invalid password' }, false, 401)
    const actor = userEvent.setup()
    render(<SignIn onSignedIn={vi.fn()} />)

    await fill(actor)
    await actor.click(screen.getByRole('button', { name: /Sign in/ }))

    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent('That email or password is incorrect.')
    expect(alert).not.toHaveTextContent(/password is invalid|no such user/i)
  })

  it('does not sign in when the credentials are rejected', async () => {
    respondWith({ message: 'Invalid password' }, false, 401)
    const onSignedIn = vi.fn()
    const actor = userEvent.setup()
    render(<SignIn onSignedIn={onSignedIn} />)

    await fill(actor)
    await actor.click(screen.getByRole('button', { name: /Sign in/ }))

    await screen.findByRole('alert')

    expect(onSignedIn).not.toHaveBeenCalled()
  })

  it('does not treat a two factor challenge as a successful sign in', async () => {
    respondWith({ twoFactorRedirect: true })
    const onSignedIn = vi.fn()
    const actor = userEvent.setup()
    render(<SignIn onSignedIn={onSignedIn} />)

    await fill(actor)
    await actor.click(screen.getByRole('button', { name: /Sign in/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/second factor/)
    expect(onSignedIn).not.toHaveBeenCalled()
  })

  it('reports an unreachable server rather than failing silently', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    const actor = userEvent.setup()
    render(<SignIn onSignedIn={vi.fn()} />)

    await fill(actor)
    await actor.click(screen.getByRole('button', { name: /Sign in/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not reach the server/)
  })

  it('sets a display name so devtools can identify it', () => {
    expect(SignIn.displayName).toBe('SignIn')
  })
})
