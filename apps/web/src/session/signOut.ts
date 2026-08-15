const signOut = async (): Promise<boolean> => {
  const response = await fetch('/api/auth/sign-out', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });

  return response.ok;
};

export { signOut };
