import { join } from 'node:path';
import { app } from 'electron';
import { theServerAddress } from '@FluxDesktop/main/theServerAddress';

const DEV_SERVER = 'ELECTRON_RENDERER_URL';

type Fillable = {
  loadURL: (address: string) => Promise<void>;
  loadFile: (path: string, options?: { search?: string }) => Promise<void>;
};

/**
 * Puts Flux into the window — the Flux running on the server somebody named, not a copy of it.
 *
 * This is the whole of the desktop client's architecture and the reason the rest of it is small. A
 * window that serves its own pages is a stranger to the server: its cookies are cross-site, its
 * requests are cross-origin, a passkey has no origin to belong to, and every one of those has to be
 * worked around. A window that loads the server's own pages is the server's own client, and none of
 * it applies — signing in, a second factor, a passkey and a password manager all work because
 * nothing is unusual about them.
 *
 * A server that does not answer falls back to the one page this client ships, carrying the address
 * that failed. A self-hosted server is off sometimes, and a laptop is away from it sometimes, so
 * this is an ordinary Tuesday rather than an error: without it the window shows nothing at all and
 * says so only in a console nobody has open.
 *
 * @param window - The window to fill.
 * @returns When it has been asked to load, which is before it has drawn.
 */
const showTheApplication = async (window: Fillable): Promise<void> => {
  const server = theServerAddress();
  const asking = join(app.getAppPath(), 'dist/index.html');

  if (server !== '') {
    try {
      await window.loadURL(server);

      return;
    } catch {
      await window.loadFile(asking, { search: `unreachable=${encodeURIComponent(server)}` });

      return;
    }
  }

  const served = process.env[DEV_SERVER];

  if (served !== undefined && served !== '') {
    await window.loadURL(served);

    return;
  }

  await window.loadFile(asking);
};

export { showTheApplication };
