/**
 * Asks whether an item's hover preview has been made yet, by requesting a single byte of it rather
 * than the clip. Distinguishes a preview still being rendered from one that will never exist, since
 * the first is worth waiting for and the second is not.
 *
 * @param url - Where the preview would be served from.
 * @returns Whether it is ready, still being made, or not coming.
 */
const readPreviewState = async (url: string): Promise<'ready' | 'pending' | 'absent'> => {
  const response = await fetch(url, { headers: { Range: 'bytes=0-0' } }).catch(() => null);

  if (response === null) {
    return 'absent';
  }

  if (response.status === 202) {
    return 'pending';
  }

  return response.ok ? 'ready' : 'absent';
};

export { readPreviewState };
