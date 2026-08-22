import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';

const WIDTH = 1280;

const HEIGHT = 800;

const MINIMUM_WIDTH = 880;

const MINIMUM_HEIGHT = 560;

/**
 * Opens the one window this client is, and puts the application in it.
 *
 * `nodeIntegration` off and `contextIsolation` on, which is what keeps the page a page: everything
 * it can do to the machine is the short list the preload script hands it, rather than everything
 * Node can do. A media client loads artwork and subtitles from a server somebody else runs, so this
 * is not a formality.
 *
 * The frame is hidden on macOS so the window reads as an application rather than as a browser, and
 * the traffic lights are inset to clear the screens' own header.
 *
 * The frame is hidden on macOS so the window reads as an application rather than as a browser, and
 * the traffic lights are inset to clear the bar the application draws along its top.
 *
 * The icon is given for the platforms that take one from the window. macOS takes its from the bundle
 * instead, which the packaging config points at the same file.
 *
 * @returns The window.
 */
const openTheWindow = (): BrowserWindow => {
  const window = new BrowserWindow({
    icon: join(app.getAppPath(), 'build/icon.png'),
    width: WIDTH,
    height: HEIGHT,
    minWidth: MINIMUM_WIDTH,
    minHeight: MINIMUM_HEIGHT,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: join(app.getAppPath(), 'dist-preload/preload/Preload.js'),
    },
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  return window;
};

export { openTheWindow };
