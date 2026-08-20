import { Menu } from 'electron';
import type { BrowserWindow } from 'electron';

/**
 * Offers the way back to choosing a server on a right click, anywhere in the window.
 *
 * There is a menu bar with the same item on it, and on macOS it sits at the top of the screen rather
 * than in the window — which is a long way from where somebody is looking, and further still when
 * the window is nearly full screen. This client has exactly one thing in it that is not the server's,
 * and somebody who cannot find it has an application pointed at a server they cannot change.
 *
 * A right click reaches it from wherever they are, on a page this client did not draw and cannot
 * put a button on.
 *
 * @param window - The window to answer a right click in.
 * @param changeServer - What to do when somebody asks for a different one.
 */
const theWindowsOwnMenu = (window: BrowserWindow, changeServer: () => void): void => {
  window.webContents.on('context-menu', () => {
    Menu.buildFromTemplate([
      { label: 'Change server…', click: changeServer },
      { type: 'separator' },
      { role: 'reload' },
      { role: 'toggleDevTools' },
    ]).popup({ window });
  });
};

export { theWindowsOwnMenu };
