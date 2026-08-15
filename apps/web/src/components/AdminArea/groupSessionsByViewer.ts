import type { ActiveSession } from '@FluxWeb/admin/fetchAdmin';

type SessionGroup = { key: string; label: string; sessions: ActiveSession[] };

/**
 * Separates every open tab out by who has it open, so an admin can see every session a given viewer
 * has running rather than one flat list.
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
