import { app, BrowserWindow, ipcMain } from 'electron';
import { answerAboutPreferences } from '@FluxDesktop/main/answerAboutPreferences';
import { GO_TO_THE_SERVER } from '@FluxDesktop/main/preferenceChannels';
import { openTheWindow } from '@FluxDesktop/main/openTheWindow';
import { theApplicationMenu } from '@FluxDesktop/main/theApplicationMenu';
import { forgetTheServerAddress } from '@FluxDesktop/main/theServerAddress';
import { showTheApplication } from '@FluxDesktop/main/showTheApplication';

app.setName('Flux');

let theWindow: BrowserWindow | null = null;

const start = async (): Promise<void> => {
  await app.whenReady();

  answerAboutPreferences(() => {});

  ipcMain.on(GO_TO_THE_SERVER, () => {
    if (theWindow !== null) {
      void showTheApplication(theWindow);
    }
  });

  theApplicationMenu(() => {
    forgetTheServerAddress();

    if (theWindow !== null) {
      void showTheApplication(theWindow);
    }
  });

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
