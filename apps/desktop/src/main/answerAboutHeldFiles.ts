import { ipcMain } from 'electron';
import { z } from 'zod';
import { WhatToKeepSchema } from '@ValenceContracts/schemas/HeldFile';
import { JsonValueSchema } from '@ValenceContracts/schemas/JsonValue';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';
import {
  CAN_REACH_NOW,
  DROP_ONE,
  EVERYTHING_HELD,
  KEEP_ONE,
  PAUSE_ONE,
  REACH_CHANGED,
  WHAT_CHANGED,
} from '@ValenceDesktop/main/heldChannels';
import type { HeldLibrary } from '@ValenceDesktop/main/theHeldLibrary';
import type { ServerReach } from '@ValenceDesktop/main/theServerReach';

const DownloadIdSchema = z.string().uuid();

const PausedSchema = z.boolean();

type Telling = (channel: string, said: JsonValue) => void;

/**
 * Lets the window ask about the files this machine is holding, and tells it when they change.
 *
 * The window never touches a file, a path or a transfer. It asks what is held, asks for something
 * to be kept or let go, and is told when any of that changes — which is what keeps every screen
 * written the same way whether it is running here or in a browser that can hold nothing.
 *
 * Everything arriving from the window is parsed before it is acted on. It is our own window today,
 * but a path assembled out of whatever a renderer said is how a renderer gets to read the rest of
 * the disk, and the cost of insisting on a download id shaped like a download id is nothing.
 *
 * Reading what is held is answered as a promise rather than at once, unlike preferences: a shelf of
 * downloads is drawn after the page is, so nothing is waiting on the answer, and finding out
 * involves the disk.
 *
 * @param library - What this machine is holding.
 * @param reach - Whether Valence is answering.
 * @param tell - How to reach the window with something it did not ask for.
 */
const answerAboutHeldFiles = (library: HeldLibrary, reach: ServerReach, tell: Telling): void => {
  ipcMain.handle(EVERYTHING_HELD, async () => JsonValueSchema.parse(await library.all()));

  ipcMain.handle(KEEP_ONE, async (_event, what: JsonValue) => {
    await library.keep(WhatToKeepSchema.parse(what));
  });

  ipcMain.handle(DROP_ONE, async (_event, downloadId: JsonValue) => {
    await library.drop(DownloadIdSchema.parse(downloadId));
  });

  ipcMain.handle(PAUSE_ONE, async (_event, downloadId: JsonValue, isPaused: JsonValue) => {
    await library.pause(DownloadIdSchema.parse(downloadId), PausedSchema.parse(isPaused));
  });

  ipcMain.on(CAN_REACH_NOW, (event) => {
    event.returnValue = reach.isReachable();
  });

  library.whenChanged((held) => {
    tell(WHAT_CHANGED, JsonValueSchema.parse(held));
  });

  reach.whenChanged((isReachable) => {
    tell(REACH_CHANGED, isReachable);
  });
};

export type { Telling };

export { answerAboutHeldFiles };
