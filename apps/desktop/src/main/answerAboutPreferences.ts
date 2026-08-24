import { ipcMain } from 'electron';
import { thePreferenceFile } from '@ValenceDesktop/main/thePreferenceFile';
import { FORGET_ONE, READ_EVERYTHING, WRITE_ONE } from '@ValenceDesktop/main/preferenceChannels';

/**
 * Lets the window read and change what the machine remembers.
 *
 * Reading is answered synchronously and once. The window asks for everything as it loads, before
 * anything is drawn, and holds the answer — because a preference is read while something is being
 * drawn and nothing sensible can be drawn around a promise. Writing goes the other way and nothing
 * waits on it.
 *
 * Only strings pass, and only ones the window names. Nothing here evaluates what it is handed.
 *
 * @param afterWrite - Told which key the window changed, for whatever in this process is holding a
 * copy that would otherwise go stale.
 */
const answerAboutPreferences = (afterWrite: (key: string) => void): void => {
  const file = thePreferenceFile();

  ipcMain.on(READ_EVERYTHING, (event) => {
    event.returnValue = file.all();
  });

  ipcMain.on(WRITE_ONE, (_event, key: string, value: string) => {
    if (typeof key === 'string' && typeof value === 'string') {
      file.write(key, value);
      afterWrite(key);
    }
  });

  ipcMain.on(FORGET_ONE, (_event, key: string) => {
    if (typeof key === 'string') {
      file.forget(key);
      afterWrite(key);
    }
  });
};

export { answerAboutPreferences };
