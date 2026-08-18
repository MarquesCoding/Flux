import { openShare } from '@FluxClient/sharing/fetchShares';
import type { ShareEnding } from '@FluxContracts/schemas/Share';

/**
 * Asks whether a link has stopped working, and why, for a guest whose stream has just failed. A
 * guest never reaches the realtime feed — that wants an account — so nothing can push the news that
 * a link was withdrawn. The stream failing is the signal, and this turns it into a sentence.
 *
 * Re-opening does not spend a view: a visit is recorded against the joiner the server already gave
 * this browser, so asking again is the same visit rather than another one.
 *
 * @param token - The token the link carries.
 * @returns How the link stopped working, or null where it still works and the fault was something
 *   else.
 */
const shareEndingFor = async (token: string): Promise<ShareEnding | null> => {
  const outcome = await openShare(token);

  return outcome.kind === 'gone' ? outcome.ended : null;
};

export { shareEndingFor };
