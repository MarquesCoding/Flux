import type { ActiveSession } from '@FluxWeb/admin/fetchAdmin';

type SessionGroup = { key: string; label: string; sessions: ActiveSession[] };

/**
 * Separates every open tab out by who has it open, so an admin can see every
 * session a given viewer has running rather than one flat list.
 *
 * Sessions with no profile gather under one heading rather than one each: an
 * unidentified tab is a thing that happens, and a column of "Unknown viewer"
 * rows says less than a single group holding all of them.
 *
 * Insertion order is kept, so the list does not reshuffle itself between
 * readings for somebody watching it.
 */
const groupSessionsByViewer = (sessions: ActiveSession[]): SessionGroup[] => {
  const groups = new Map<string, SessionGroup>();

  for (const session of sessions) {
    const key = session.profileId ?? 'unknown';
    const existing = groups.get(key);

    if (existing === undefined) {
      groups.set(key, { key, label: session.profileName ?? 'Unknown viewer', sessions: [session] });
    } else {
      existing.sessions.push(session);
    }
  }

  return [...groups.values()];
};

export { groupSessionsByViewer };
export type { SessionGroup };
