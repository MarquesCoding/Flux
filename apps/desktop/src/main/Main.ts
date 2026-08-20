import { app, BrowserWindow, ipcMain } from 'electron';
import { answerAboutPreferences } from '@FluxDesktop/main/answerAboutPreferences';
import {
  CHANGE_SERVER,
  GO_TO_THE_SERVER,
  NOW_WATCHING,
} from '@FluxDesktop/main/preferenceChannels';
import { openTheWindow } from '@FluxDesktop/main/openTheWindow';
import { theApplicationMenu } from '@FluxDesktop/main/theApplicationMenu';
import { theDockIcon } from '@FluxDesktop/main/theDockIcon';
import { tellDiscord } from '@FluxDesktop/main/tellDiscord';
import { whatIsPlaying } from '@FluxDesktop/main/whatIsPlaying';
import { JsonValueSchema } from '@FluxContracts/schemas/JsonValue';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';
import { theWindowsOwnMenu } from '@FluxDesktop/main/theWindowsOwnMenu';
import { forgetTheServerAddress } from '@FluxDesktop/main/theServerAddress';
import { showTheApplication } from '@FluxDesktop/main/showTheApplication';

app.setName('Flux');

let theWindow: BrowserWindow | null = null;

const start = async (): Promise<void> => {
  await app.whenReady();

  answerAboutPreferences(() => {});

  const changeServer = () => {
    forgetTheServerAddress();

    if (theWindow !== null) {
      void showTheApplication(theWindow);
    }
  };

  ipcMain.on(GO_TO_THE_SERVER, () => {
    if (theWindow !== null) {
      void showTheApplication(theWindow);
    }
  });

  theDockIcon();

  ipcMain.on(CHANGE_SERVER, changeServer);

  const discord = tellDiscord(app.getPath('temp'));

  ipcMain.on(NOW_WATCHING, (_event, said: JsonValue) => {
    discord.about(whatIsPlaying(JsonValueSchema.catch(null).parse(said)));
  });

  app.on('will-quit', () => {
    discord.close();
  });

  theApplicationMenu(changeServer);

  theWindow = openTheWindow();
  theWindowsOwnMenu(theWindow, changeServer);

  await showTheApplication(theWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      theWindow = openTheWindow();
      theWindowsOwnMenu(theWindow, changeServer);

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
