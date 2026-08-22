import { formatBytes } from '@ValenceCore/functions/formatBytes';

/**
 * Says how much memory Valence is holding, in words that stay honest at the edges: a reading that was
 * never taken says so rather than reading as nothing being used.
 *
 * @param bytes - What Valence is holding, or null where it could not be worked out.
 * @returns The phrase to show.
 */
const describeValenceMemory = (bytes: number | null): string =>
  bytes === null ? 'not measured' : formatBytes(bytes);

export { describeValenceMemory };
