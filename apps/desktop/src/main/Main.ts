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
import { forgetTheServerAddress, theServerAddress } from '@FluxDesktop/main/theServerAddress';
import { FOUND_A_FLUX, WHAT_WAS_FOUND } from '@FluxDesktop/main/discoveryChannels';
import { keepLookingForAFlux, lookForAFlux } from '@FluxDesktop/main/lookForAFlux';
import { showTheApplication } from '@FluxDesktop/main/showTheApplication';
import { claimTheScheme, serveTheApplication } from '@FluxDesktop/main/serveTheApplication';
import { carryTheSessionToTheSocket } from '@FluxDesktop/main/carryTheSessionToTheSocket';

app.setName('Flux');

claimTheScheme();

let theWindow: BrowserWindow | null = null;

let stopLooking: (() => void) | null = null;

let whatWasFound: string[] = [];

/**
 * Finds this machine's Flux, and offers it rather than deciding with it.
 *
 * Nobody should have to type the address of a server running on the machine they are sitting at. But
 * finding one is not the same as it being theirs — somebody may run two, or be setting one up while
 * watching another — so what is found is offered on the screen that asks, as something to press
 * instead of something to type.
 *
 * Looked for once on the way up, and then quietly for a minute more while that screen is on show,
 * because a server started at the same moment as this client has not finished starting when the
 * client is ready to ask. One that turns up late appears on the screen the moment it does.
 */
const findAFlux = async (): Promise<void> => {
  if (theServerAddress() !== '') {
    return;
  }

  const offer = (address: string): void => {
    if (whatWasFound.includes(address)) {
      return;
    }

    whatWasFound = [...whatWasFound, address];

    if (theWindow !== null && !theWindow.isDestroyed()) {
      theWindow.webContents.send(FOUND_A_FLUX, address);
    }
  };

  const here = await lookForAFlux();

  if (here !== null) {
    offer(here);

    return;
  }

  stopLooking?.();
  stopLooking = keepLookingForAFlux(offer);
};

const start = async (): Promise<void> => {
  await app.whenReady();

  serveTheApplication();
  carryTheSessionToTheSocket();

  answerAboutPreferences(() => {});

  ipcMain.on(WHAT_WAS_FOUND, (event) => {
    event.returnValue = whatWasFound;
  });

  const changeServer = () => {
    forgetTheServerAddress();

    void findAFlux();

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

  const discord = tellDiscord(app.getPath('temp'), app.getVersion());

  ipcMain.on(NOW_WATCHING, (_event, said: JsonValue) => {
    discord.about(whatIsPlaying(JsonValueSchema.catch(null).parse(said)));
  });

  app.on('will-quit', () => {
    discord.close();
  });

  theApplicationMenu(changeServer);

  theWindow = openTheWindow();
  theWindowsOwnMenu(theWindow, changeServer);

  await findAFlux();
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
