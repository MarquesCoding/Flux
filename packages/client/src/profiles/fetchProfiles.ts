import { readFromServer } from '@FluxClient/query/readFromServer';
import { ViewerProfileListSchema } from '@FluxContracts/schemas/ViewerProfile';
import type { Avatar, ProfileColour, ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';

/**
 * The profiles on this account, each with their own history, favourites and watch progress.
 */
const fetchProfiles = async (): Promise<ViewerProfile[]> => {
  return (await readFromServer('/api/profiles', ViewerProfileListSchema)).profiles;
};

/**
 * Adds somebody to this account, with their own history, favourites and watch progress.
 *
 * @param name - What to call them.
 * @param colour - The colour their face is drawn in.
 * @param avatar - What to draw them as, where they chose something other than a colour.
 * @returns Whether they were added.
 */
const createProfile = async (
  name: string,
  colour: ProfileColour,
  avatar?: Avatar,
): Promise<boolean> => {
  const response = await fetch('/api/profiles', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(avatar === undefined ? { name, colour } : { name, colour, avatar }),
  }).catch(() => null);

  return response !== null && response.ok;
};

/**
 * Changes what a profile is called and what it is drawn as. Nothing it has watched, kept or got part
 * way through is affected: those hang off the profile itself rather than off its name.
 *
 * @param profileId - The profile to change.
 * @param name - What to call them.
 * @param colour - The colour their face is drawn in.
 * @param avatar - What to draw them as, where they chose something other than a colour.
 * @returns Whether the change was written.
 */
const saveProfile = async (
  profileId: string,
  name: string,
  colour: ProfileColour,
  avatar?: Avatar,
  askStillWatchingAfter?: number,
): Promise<boolean> => {
  const response = await fetch(`/api/profiles/${profileId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name,
      colour,
      ...(avatar === undefined ? {} : { avatar }),
      ...(askStillWatchingAfter === undefined ? {} : { askStillWatchingAfter }),
    }),
  }).catch(() => null);

  return response !== null && response.ok;
};

/**
 * Uploads somebody's own photograph for a profile, which replaces whatever it was drawn as.
 *
 * @param profileId - The profile.
 * @param file - The photograph.
 * @returns The profile as it now stands, or why it was refused.
 */
const uploadProfilePhoto = async (profileId: string, file: File): Promise<boolean> => {
  const response = await fetch(`/api/profiles/${profileId}/photo`, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  }).catch(() => null);

  return response !== null && response.ok;
};

/**
 * Removes somebody from this account, and everything hanging off them — their history, their
 * favourites, where they had got to.
 *
 * @param profileId - The profile to remove.
 */
const removeProfile = async (profileId: string): Promise<boolean> => {
  const response = await fetch(`/api/profiles/${profileId}`, { method: 'DELETE' }).catch(
    () => null,
  );

  return response !== null && response.ok;
};

export { fetchProfiles, createProfile, saveProfile, removeProfile, uploadProfilePhoto };
