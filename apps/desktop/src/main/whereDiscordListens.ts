const SOCKETS = 10;

const FLATPAK = 'app/com.discordapp.Discord';

const SNAP = 'snap.discord';

/**
 * Every place the Discord client might be listening, in the order worth trying.
 *
 * Discord numbers its socket, because more than one build can run at once — stable beside canary,
 * say — so there is no single path to open, only ten to try in turn.
 *
 * Where that directory is differs by platform and by how Discord was installed. A named pipe on
 * Windows; the session's runtime directory on Linux, with Flatpak and Snap each keeping theirs
 * inside a directory of their own; and the temporary directory on a Mac, which is per-user and not
 * the shared one.
 *
 * @param platform - What this process is running on.
 * @param environment - The variables that say where the session keeps its sockets.
 * @returns The paths to try, in order.
 */
const whereDiscordListens = (
  platform: string,
  environment: Record<string, string | undefined>,
): string[] => {
  const numbered = Array.from({ length: SOCKETS }, (_, at) => at);

  if (platform === 'win32') {
    return numbered.map((at) => `\\\\?\\pipe\\discord-ipc-${at.toString()}`);
  }

  const base =
    environment['XDG_RUNTIME_DIR'] ??
    environment['TMPDIR'] ??
    environment['TMP'] ??
    environment['TEMP'] ??
    '/tmp';

  const trimmed = base.replace(/\/+$/, '');

  return [trimmed, `${trimmed}/${FLATPAK}`, `${trimmed}/${SNAP}`].flatMap((directory) =>
    numbered.map((at) => `${directory}/discord-ipc-${at.toString()}`),
  );
};

export { whereDiscordListens };
