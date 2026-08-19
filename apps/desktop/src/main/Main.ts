import { app, BrowserWindow } from 'electron';
import { answerAboutPreferences } from '@FluxDesktop/main/answerAboutPreferences';
import { carryTheSession } from '@FluxDesktop/main/carryTheSession';
import { openTheWindow } from '@FluxDesktop/main/openTheWindow';
import { showTheApplication } from '@FluxDesktop/main/showTheApplication';
import { theDesktopsAuth } from '@FluxDesktop/main/theDesktopsAuth';

let theWindow: BrowserWindow | null = null;

const auth = theDesktopsAuth();

auth.setupMain({ getWindow: () => theWindow });

const start = async (): Promise<void> => {
  await app.whenReady();

  answerAboutPreferences();
  carryTheSession(auth);

  theWindow = openTheWindow();

  await showTheApplication(theWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      theWindow = openTheWindow();

      void showTheApplication(theWindow);
    }
  });
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

void start();
