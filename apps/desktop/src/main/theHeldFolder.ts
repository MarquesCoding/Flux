import { join } from 'node:path';

const FOLDER = 'held';

/**
 * Where this client keeps the files somebody meant to keep.
 *
 * Under the client's own user data rather than the machine's downloads folder, and deliberately so.
 * A file in Downloads belongs to the person and to every other application on the machine: it is
 * renamed, moved, tidied away by the operating system, and swept by whatever cleans up after a full
 * disk. This application would go on listing something that is no longer there.
 *
 * Here, one thing owns them, knows their names without being told, and can say honestly what is
 * still on the disk. Somebody who wants a copy of their own can still be handed one; that is a
 * different thing from the copy the application plays.
 *
 * @param userData - Where this client keeps everything else of its own.
 * @returns The folder.
 */
const theHeldFolder = (userData: string): string => join(userData, FOLDER);

/**
 * Where the file for one prepared download lives.
 *
 * Named by the download rather than by the film. Two people watching the same film at different
 * qualities are two prepared downloads and two files, and a name built from a title would collide
 * on exactly the pair somebody most wants to keep apart — as well as needing to be sanitised for
 * every character an operating system dislikes in a name.
 *
 * @param folder - The held folder.
 * @param downloadId - The prepared download.
 * @returns The path.
 */
const theFileKept = (folder: string, downloadId: string): string =>
  join(folder, `${downloadId}.mp4`);

/**
 * Where the artwork for one prepared download lives.
 *
 * Kept beside the film rather than inside the index, because the index is read and rewritten every
 * time anything about a transfer changes, and a few hundred kilobytes of image encoded into it
 * would be parsed and serialised on every progress report.
 *
 * @param folder - The held folder.
 * @param downloadId - The prepared download.
 * @returns The path.
 */
const thePosterKept = (folder: string, downloadId: string): string =>
  join(folder, `${downloadId}.jpg`);

export { theFileKept, theHeldFolder, thePosterKept };
