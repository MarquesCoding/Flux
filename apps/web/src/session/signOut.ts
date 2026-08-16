/**
 * Ends this session on the server, so the cookie is cleared where it was issued rather than only
 * being forgotten here.
 *
 * @returns Whether the session was ended.
 */
const signOut = async (): Promise<boolean> => {
  const response = await fetch('/api/auth/sign-out', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });

  return response.ok;
};

export { signOut };
