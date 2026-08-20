import { app, BrowserWindow } from 'electron';
import { answerAboutPreferences } from '@FluxDesktop/main/answerAboutPreferences';
import { holdTheSession } from '@FluxDesktop/main/holdTheSession';
import { letTheBrowserSendThemBack } from '@FluxDesktop/main/letTheBrowserSendThemBack';
import { openTheWindow } from '@FluxDesktop/main/openTheWindow';
import { showTheApplication } from '@FluxDesktop/main/showTheApplication';
import { theDesktopsAuth } from '@FluxDesktop/main/theDesktopsAuth';
import { theServerAddress } from '@FluxDesktop/main/theServerAddress';
import { pointSignInAt } from '@FluxDesktop/main/whereToSignIn';

let theWindow: BrowserWindow | null = null;

const auth = theDesktopsAuth();

letTheBrowserSendThemBack(auth, () => theWindow);

const start = async (): Promise<void> => {
  await app.whenReady();

  pointSignInAt(theServerAddress());
  answerAboutPreferences(() => {
    pointSignInAt(theServerAddress());
  });
  holdTheSession();

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
