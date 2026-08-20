import { describe, expect, it } from 'vitest';
import { whereDiscordListens } from './whereDiscordListens';

describe('whereDiscordListens', () => {
  it('tries ten, since Discord numbers its socket and more than one build can run', () => {
    const found = whereDiscordListens('darwin', { TMPDIR: '/var/folders/x/T' });

    expect(found.filter((path) => path.startsWith('/var/folders/x/T/discord-ipc-'))).toHaveLength(
      10,
    );
  });

  it('asks a Mac for the per-user temporary directory rather than the shared one', () => {
    expect(whereDiscordListens('darwin', { TMPDIR: '/var/folders/x/T' })[0]).toBe(
      '/var/folders/x/T/discord-ipc-0',
    );
  });

  it('asks Windows for a named pipe, which is not a path in a directory', () => {
    expect(whereDiscordListens('win32', {})[0]).toBe('\\\\?\\pipe\\discord-ipc-0');
  });

  it('prefers the session runtime directory on Linux', () => {
    expect(whereDiscordListens('linux', { XDG_RUNTIME_DIR: '/run/user/1000', TMPDIR: '/tmp' })[0]).toBe(
      '/run/user/1000/discord-ipc-0',
    );
  });

  it('looks inside Flatpak and Snap, which keep theirs a directory further in', () => {
    const found = whereDiscordListens('linux', { XDG_RUNTIME_DIR: '/run/user/1000' });

    expect(found).toContain('/run/user/1000/app/com.discordapp.Discord/discord-ipc-0');
    expect(found).toContain('/run/user/1000/snap.discord/discord-ipc-0');
  });

  it('falls back to the temporary directory where the session says nothing', () => {
    expect(whereDiscordListens('linux', {})[0]).toBe('/tmp/discord-ipc-0');
  });

  it('does not double the slash on a directory that ends in one', () => {
    expect(whereDiscordListens('linux', { XDG_RUNTIME_DIR: '/run/user/1000/' })[0]).toBe(
      '/run/user/1000/discord-ipc-0',
    );
  });

  it('tries the plain directory before the packaged ones, which is where most are', () => {
    const found = whereDiscordListens('linux', { XDG_RUNTIME_DIR: '/run/user/1000' });

    expect(found.indexOf('/run/user/1000/discord-ipc-0')).toBeLessThan(
      found.indexOf('/run/user/1000/app/com.discordapp.Discord/discord-ipc-0'),
    );
  });
});
