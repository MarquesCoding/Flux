import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, net } from 'electron';
import { answerAboutPreferences } from '@ValenceDesktop/main/answerAboutPreferences';
import {
  CHANGE_SERVER,
  GO_TO_THE_SERVER,
  NOW_WATCHING,
} from '@ValenceDesktop/main/preferenceChannels';
import { openTheWindow } from '@ValenceDesktop/main/openTheWindow';
import { theApplicationMenu } from '@ValenceDesktop/main/theApplicationMenu';
import { theDockIcon } from '@ValenceDesktop/main/theDockIcon';
import { tellDiscord } from '@ValenceDesktop/main/tellDiscord';
import { whatIsPlaying } from '@ValenceDesktop/main/whatIsPlaying';
import { JsonValueSchema } from '@ValenceContracts/schemas/JsonValue';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';
import { theWindowsOwnMenu } from '@ValenceDesktop/main/theWindowsOwnMenu';
import { forgetTheServerAddress, theServerAddress } from '@ValenceDesktop/main/theServerAddress';
import { FOUND_A_VALENCE, WHAT_WAS_FOUND } from '@ValenceDesktop/main/discoveryChannels';
import { keepLookingForAValence, lookForAValence } from '@ValenceDesktop/main/lookForAValence';
import { carryOldKeysOver } from '@ValenceClient/platform/carryOldKeysOver';
import { thePreferenceFile } from '@ValenceDesktop/main/thePreferenceFile';
import { showTheApplication } from '@ValenceDesktop/main/showTheApplication';
import { claimTheScheme, serveTheApplication } from '@ValenceDesktop/main/serveTheApplication';
import { carryTheSessionToTheSocket } from '@ValenceDesktop/main/carryTheSessionToTheSocket';
import { answerAboutHeldFiles } from '@ValenceDesktop/main/answerAboutHeldFiles';
import { theHeldFolder } from '@ValenceDesktop/main/theHeldFolder';
import { theHeldIndex } from '@ValenceDesktop/main/theHeldIndex';
import { theHeldLibrary } from '@ValenceDesktop/main/theHeldLibrary';
import { theServerReach } from '@ValenceDesktop/main/theServerReach';
import type { AskingTheServer } from '@ValenceDesktop/main/keepADownload';

const WHERE_IT_HAS_ALWAYS_BEEN = 'Valence';

const ASK_AGAIN_EVERY = 15_000;

/**
 * Asks Valence for something from out here, where none of a page's rules apply.
 *
 * Wrapped rather than handed over as it stands, because passing a method around detached from what
 * it belongs to is how it ends up called with the wrong `this` — and because what the rest of this
 * wants is the narrow thing it actually calls rather than everything a fetch can do.
 *
 * @param where - The address.
 * @param how - What to send.
 * @returns The answer.
 */
const askValence: AskingTheServer = (where, how) => net.fetch(where, how);

app.setName('Valence');

/**
 * Keeps this client's own files where they already are, under the name it used to have.
 *
 * The application's name decides where Electron puts its user data, and its user data is where the
 * session cookie lives. Renaming it therefore signs everybody out and forgets which server they had
 * chosen — quietly, at the moment they open a version that is only supposed to look different.
 *
 * So the name changes and the path does not. Moving it is a decision of its own, wants a migration
 * that carries the old directory across, and is not this.
 */
const keepThisClientsFilesWhereTheyAre = (): void => {
  app.setPath('userData', join(app.getPath('appData'), WHERE_IT_HAS_ALWAYS_BEEN));
};

keepThisClientsFilesWhereTheyAre();

claimTheScheme();

let theWindow: BrowserWindow | null = null;

let stopLooking: (() => void) | null = null;

let whatWasFound: string[] = [];

/**
 * Finds this machine's Valence, and offers it rather than deciding with it.
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
const findAValence = async (): Promise<void> => {
  if (theServerAddress() !== '') {
    return;
  }

  const offer = (address: string): void => {
    if (whatWasFound.includes(address)) {
      return;
    }

    whatWasFound = [...whatWasFound, address];

    if (theWindow !== null && !theWindow.isDestroyed()) {
      theWindow.webContents.send(FOUND_A_VALENCE, address);
    }
  };

  const here = await lookForAValence();

  if (here !== null) {
    offer(here);

    return;
  }

  stopLooking?.();
  stopLooking = keepLookingForAValence(offer);
};

/**
 * Carries what this machine already remembers to the names it is remembered under now.
 *
 * The window does this for itself as it installs its platform, and this process cannot wait for it:
 * it reads which server was chosen before there is a window at all, to know what to open. Read a
 * moment too early, that key is absent and the client asks all over again for something it was
 * already told.
 *
 * The same file either way, so whichever gets there first does the work and the other finds it done.
 */
const carryWhatThisMachineRemembers = (): void => {
  const file = thePreferenceFile();

  carryOldKeysOver({ read: file.read, write: file.write, forget: file.forget });
};

const start = async (): Promise<void> => {
  await app.whenReady();

  carryWhatThisMachineRemembers();

  const held = theHeldFolder(app.getPath('userData'));

  const reach = theServerReach({
    where: theServerAddress,
    fetching: askValence,
    every: ASK_AGAIN_EVERY,
  });

  const library = theHeldLibrary({
    folder: held,
    index: theHeldIndex(),
    where: theServerAddress,
    fetching: askValence,
    now: () => new Date().toISOString(),
  });

  serveTheApplication(reach, held);
  carryTheSessionToTheSocket();

  answerAboutPreferences(() => {});

  answerAboutHeldFiles(library, reach, (channel, said) => {
    if (theWindow !== null && !theWindow.isDestroyed()) {
      theWindow.webContents.send(channel, said);
    }
  });

  reach.whenChanged((isReachable) => {
    if (isReachable) {
      void library.carryOnWhereItLeftOff();
    }
  });

  app.on('will-quit', () => {
    reach.stop();
  });

  ipcMain.on(WHAT_WAS_FOUND, (event) => {
    event.returnValue = whatWasFound;
  });

  const changeServer = () => {
    forgetTheServerAddress();

    void findAValence();

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

  await findAValence();
  await showTheApplication(theWindow);

  await library.carryOnWhereItLeftOff();

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
