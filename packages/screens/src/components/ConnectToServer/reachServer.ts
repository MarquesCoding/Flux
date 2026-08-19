/**
 * Asks an address whether there is a Flux behind it, before anything is kept.
 *
 * Health is the one thing a server answers to nobody in particular, so it can be asked before there
 * is a session, a token, or any reason to believe the address is right at all.
 *
 * @param address - Where the viewer said their Flux is.
 * @returns Whether a Flux answered.
 */
const reachServer = async (address: string): Promise<boolean> => {
  const answered = await fetch(`${address}/api/health`, {
    headers: { accept: 'application/json' },
  }).catch(() => null);

  return answered !== null && answered.ok;
};

export { reachServer };
