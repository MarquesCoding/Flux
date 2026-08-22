import type { ActiveSession } from '@ValenceClient/admin/fetchAdmin';

type SessionGroup = { key: string; label: string; sessions: ActiveSession[] };

/**
 * Separates every open tab out by who has it open, so an administrator sees each viewer once with
 * everything they have running underneath, rather than one flat list in which somebody with four
 * tabs open looks like four people. Sessions belonging to nobody recognisable are grouped together
 * rather than dropped.
 *
 * @param sessions - Every session open at the moment.
 * @returns The sessions by viewer, in the order the viewers were first seen.
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
