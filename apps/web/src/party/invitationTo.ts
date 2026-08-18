import { HOME, writeLocation } from '@FluxClient/navigation/readLocation';

/**
 * The address that puts somebody else in this party, watching this.
 *
 * Built from the same writer the address bar uses rather than assembled by hand, so an invitation
 * cannot drift out of step with what the application will actually read back — a link that opens
 * the wrong place is worse than no link.
 *
 * Absolute, because it is going somewhere else. It carries no credential of its own: whoever opens
 * it still has to have an account here and still has to be allowed to watch the title, which is
 * what makes an account-holder party add no new way into the library.
 *
 * @param partyId - The party being joined.
 * @param mediaId - What the party is watching.
 * @param origin - Where this instance is reached, for a test that has no window.
 * @returns The address to send.
 */
const invitationTo = (
  partyId: string,
  mediaId: string,
  origin = typeof window === 'undefined' ? '' : window.location.origin,
): string => `${origin}${writeLocation({ ...HOME, playing: mediaId, party: partyId })}`;

export { invitationTo };
