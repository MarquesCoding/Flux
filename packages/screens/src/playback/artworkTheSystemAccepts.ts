const ACCEPTED = new Set(['http:', 'https:', 'data:', 'blob:']);

/**
 * The address of a picture, where the system will take the address as it stands.
 *
 * The Media Session API refuses artwork that is not `http`, `https`, `data` or `blob`, and refuses
 * it by drawing nothing: what somebody sees is the blank square this exists to avoid. A browser
 * serves the application over `http` and so is never refused, which is why this answers immediately
 * and the fetching version below is only reached by a host that serves it from a scheme of its own.
 *
 * @param path - The picture, as the application addresses it.
 * @returns The address to hand over, or nothing where it has to be fetched instead.
 */
const artworkTheSystemAccepts = (path: string): string | null =>
  ACCEPTED.has(new URL(path, globalThis.location.href).protocol) ? path : null;

/**
 * Fetches a picture the system would otherwise refuse, and offers it as one it will take.
 *
 * The bytes are the same bytes; only the address is unacceptable. Fetching them and handing over a
 * `blob` says the same thing in a vocabulary the system has, at the cost of holding one poster in
 * memory — which is why what this returns has to be released when it stops being drawn.
 *
 * @param path - The picture, as the application addresses it.
 * @returns An address the system will take, or nothing where the picture could not be fetched.
 */
const artworkFetchedForTheSystem = async (path: string): Promise<string | null> => {
  const response = await fetch(path).catch(() => null);

  if (response === null || !response.ok) {
    return null;
  }

  const picture = await response.blob().catch(() => null);

  return picture === null ? null : URL.createObjectURL(picture);
};

export { ACCEPTED, artworkFetchedForTheSystem, artworkTheSystemAccepts };
