import { formatDuration } from '@ValenceCore/functions/formatDuration';
import type { SequencedCommand } from '@ValenceContracts/schemas/WatchParty';

/**
 * What to tell the room about something somebody else just did to the picture.
 *
 * Shared control means the film stops and starts for reasons that are not yours, and a picture that
 * pauses itself with no explanation reads as a fault rather than as a friend. Saying who did it
 * turns an apparent bug into an ordinary event.
 *
 * Nothing is said about your own commands: you know what you pressed, and being told is noise.
 *
 * @param command - What just happened, as the server sequenced it.
 * @param meConnectionId - Which member this tab is.
 * @returns The line to show, or null where there is nothing worth saying.
 */
const describeCommand = (
  command: SequencedCommand,
  meConnectionId: string | null,
): string | null => {
  if (command.byConnectionId === meConnectionId) {
    return null;
  }

  if (command.command.kind === 'play') {
    return `${command.byName} pressed play`;
  }

  if (command.command.kind === 'pause') {
    return `${command.byName} paused`;
  }

  if (command.command.kind === 'seek') {
    return `${command.byName} skipped to ${formatDuration(command.command.atSeconds)}`;
  }

  return `${command.byName} put something else on`;
};

export { describeCommand };
