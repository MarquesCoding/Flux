import { join } from 'node:path';
import { app } from 'electron';
import { theServerAddress } from '@FluxDesktop/main/theServerAddress';

const DEV_SERVER = 'ELECTRON_RENDERER_URL';

type Fillable = {
  loadURL: (address: string) => Promise<void>;
  loadFile: (path: string) => Promise<void>;
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
 * The page this client ships is only the one that asks which Flux is yours, shown until somebody has
 * said. After that this window is a browser looking at their server, with the things a browser
 * cannot have added to it.
 *
 * @param window - The window to fill.
 * @returns When it has been asked to load, which is before it has drawn.
 */
const showTheApplication = async (window: Fillable): Promise<void> => {
  const server = theServerAddress();

  if (server !== '') {
    await window.loadURL(server);

    return;
  }

  const served = process.env[DEV_SERVER];

  if (served !== undefined && served !== '') {
    await window.loadURL(served);

    return;
  }

  await window.loadFile(join(app.getAppPath(), 'dist/index.html'));
};

export { showTheApplication };
