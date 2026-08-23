import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import { markTheDocument } from '@ValenceDesktop/preload/markTheDocument';
import { z } from 'zod';
import { FOUND_A_VALENCE, WHAT_WAS_FOUND } from '@ValenceDesktop/main/discoveryChannels';
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
import {
  CHANGE_SERVER,
  NOW_WATCHING,
  FORGET_ONE,
  GO_TO_THE_SERVER,
  READ_EVERYTHING,
  WRITE_ONE,
} from '@ValenceDesktop/main/preferenceChannels';

const HeldSchema = z.record(z.string(), z.string()).catch({});

const held = HeldSchema.parse(ipcRenderer.sendSync(READ_EVERYTHING));

const alreadyFound = z.array(z.string()).catch([]).parse(ipcRenderer.sendSync(WHAT_WAS_FOUND));

const canReachNow = z.boolean().catch(true).parse(ipcRenderer.sendSync(CAN_REACH_NOW));

markTheDocument(document);

document.addEventListener('valence:change-server', () => {
  ipcRenderer.send(CHANGE_SERVER);
});

document.addEventListener('valence:now-watching', (event) => {
  ipcRenderer.send(NOW_WATCHING, event instanceof CustomEvent ? event.detail : null);
});

contextBridge.exposeInMainWorld('valence', {
  preferences: {
    held,
    write: (key: string, value: string) => {
      ipcRenderer.send(WRITE_ONE, key, value);
    },
    forget: (key: string) => {
      ipcRenderer.send(FORGET_ONE, key);
    },
  },
  goToTheServer: () => {
    ipcRenderer.send(GO_TO_THE_SERVER);
  },
  held: {
    all: async (): Promise<JsonValue> =>
      JsonValueSchema.parse(await ipcRenderer.invoke(EVERYTHING_HELD)),
    keep: async (what: JsonValue): Promise<void> => {
      await ipcRenderer.invoke(KEEP_ONE, what);
    },
    drop: async (downloadId: string): Promise<void> => {
      await ipcRenderer.invoke(DROP_ONE, downloadId);
    },
    pause: async (downloadId: string, isPaused: boolean): Promise<void> => {
      await ipcRenderer.invoke(PAUSE_ONE, downloadId, isPaused);
    },
    whenChanged: (listener: (held: JsonValue) => void) => {
      const told = (_event: IpcRendererEvent, held: JsonValue) => {
        listener(JsonValueSchema.parse(held));
      };

      ipcRenderer.on(WHAT_CHANGED, told);

      return () => {
        ipcRenderer.removeListener(WHAT_CHANGED, told);
      };
    },
  },
  reach: {
    now: canReachNow,
    whenChanged: (listener: (isReachable: boolean) => void) => {
      const told = (_event: IpcRendererEvent, isReachable: JsonValue) => {
        listener(z.boolean().catch(true).parse(isReachable));
      };

      ipcRenderer.on(REACH_CHANGED, told);

      return () => {
        ipcRenderer.removeListener(REACH_CHANGED, told);
      };
    },
  },
  servers: {
    alreadyFound,
    whenFound: (listener: (address: string) => void) => {
      const told = (_event: IpcRendererEvent, address: string) => {
        listener(address);
      };

      ipcRenderer.on(FOUND_A_VALENCE, told);

      return () => {
        ipcRenderer.removeListener(FOUND_A_VALENCE, told);
      };
    },
  },
});
