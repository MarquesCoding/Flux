/**
 * Whether an item has a preview clip to play, and if not, why not.
 *
 * Asked before the clip is handed to a video element rather than after it
 * fails. A `<video>` pointed at a missing clip fires `play` the instant it is
 * asked to start — before any data arrives and whatever the source turns out
 * to be — so a card that swaps to it on that event lands on an empty black
 * frame and stays there. Knowing first means never making the swap.
 *
 * Costs one byte: the range asks for it, and the server answers `202` while a
 * clip is being made and `404` when there will not be one, before any body is
 * read.
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
