/**
 * Ends the current session.
 *
 * Resolves to whether the server confirmed the sign-out. Callers should
 * refresh session state from the server afterwards rather than assuming the
 * local state is now correct.
 */
const signOut = async (): Promise<boolean> => {
  const response = await fetch('/api/auth/sign-out', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })

  return response.ok
}

export { signOut }
