import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';

/**
 * Names whoever a session belongs to, from the profiles on their account.
 *
 * Falls back to the account's own profile where the session named none. A browser reports which
 * profile is watching from what it stored when one was chosen, and nothing has ever stored it — so
 * every session arrived unnamed and the administrator's list read `Unknown viewer` for everybody,
 * including the person reading it. The account identifies the watcher well enough on its own while
 * an account holds one profile, which is every account here.
 *
 * The oldest is the account's own, being the one made for it when it had none.
 *
 * @param held - The profiles on the account, oldest first.
 * @param profileId - The profile the session named, where it named one.
 * @returns The name to show, or nothing where the account has no profile at all.
 */
const nameForViewer = (held: ViewerProfile[], profileId: string | null): string | null => {
  const named = profileId === null ? undefined : held.find((one) => one.id === profileId);

  return (named ?? held[0])?.name ?? null;
};

export { nameForViewer };
