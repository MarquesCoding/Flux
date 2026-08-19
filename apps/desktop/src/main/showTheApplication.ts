import { join } from 'node:path';
import { app } from 'electron';
import type { BrowserWindow } from 'electron';

const DEV_SERVER = 'ELECTRON_RENDERER_URL';

/**
 * Puts the application into a window, from wherever it is being served.
 *
 * A dev server while it is being worked on, and the built files once it is packaged. This is the one
 * place that difference exists; nothing else in the process knows which it is.
 *
 * @param window - The window to fill.
 * @returns When it has been asked to load, which is before it has drawn.
 */
const showTheApplication = async (window: BrowserWindow): Promise<void> => {
  const served = process.env[DEV_SERVER];

  if (served !== undefined && served !== '') {
    await window.loadURL(served);

    return;
  }

  await window.loadFile(join(app.getAppPath(), 'dist/index.html'));
};

export { showTheApplication };
