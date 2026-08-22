import { Menu, shell } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';

const IS_MAC = process.platform === 'darwin';

/**
 * Builds the menu, whose one unusual item is the way back to choosing a server.
 *
 * Everything else is the menu any application has, and it is here because setting a menu at all
 * replaces the one Electron provides — so leaving it out would take copy and paste with it.
 *
 * Changing server has to be a menu item rather than a button on a screen. Once the window is showing
 * the server's own pages there is no screen of ours left to put it on, and the server's Valence has no
 * idea it is being looked at through a window that could be pointed somewhere else. A menu is the
 * part of a desktop application that belongs to the application rather than to what it is showing,
 * which is exactly what this is.
 *
 * It is under File on every platform, and on the application menu as well where there is one. The
 * application menu takes its name from the bundle rather than from anything here, so somebody
 * looking for Valence may be reading a menu called something else — and somebody who cannot find the
 * thing that points this window at their server has an application that does nothing.
 *
 * @param changeServer - What to do when somebody asks for a different one.
 * @returns The menu, already set.
 */
const theApplicationMenu = (changeServer: () => void): Menu => {
  const flux: MenuItemConstructorOptions = {
    label: 'Valence',
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { label: 'Change server…', accelerator: 'CmdOrCtrl+Shift+S', click: changeServer },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  };

  const file: MenuItemConstructorOptions = {
    label: 'File',
    submenu: [
      { label: 'Change server…', accelerator: 'CmdOrCtrl+Shift+S', click: changeServer },
      ...(IS_MAC ? [] : [{ type: 'separator' } as const, { role: 'quit' } as const]),
    ],
  };

  const menu = Menu.buildFromTemplate([
    ...(IS_MAC ? [flux] : []),
    file,
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Valence on the web',
          click: () => {
            void shell.openExternal('https://github.com/MarquesCoding/Flux');
          },
        },
      ],
    },
  ]);

  Menu.setApplicationMenu(menu);

  return menu;
};

export { theApplicationMenu };
