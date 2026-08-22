import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import { markTheDocument } from '@ValenceDesktop/preload/markTheDocument';
import { z } from 'zod';
import { FOUND_A_FLUX, WHAT_WAS_FOUND } from '@ValenceDesktop/main/discoveryChannels';
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

markTheDocument(document);

document.addEventListener('flux:change-server', () => {
  ipcRenderer.send(CHANGE_SERVER);
});

document.addEventListener('flux:now-watching', (event) => {
  ipcRenderer.send(NOW_WATCHING, event instanceof CustomEvent ? event.detail : null);
});

contextBridge.exposeInMainWorld('flux', {
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
  servers: {
    alreadyFound,
    whenFound: (listener: (address: string) => void) => {
      const told = (_event: IpcRendererEvent, address: string) => {
        listener(address);
      };

      ipcRenderer.on(FOUND_A_FLUX, told);

      return () => {
        ipcRenderer.removeListener(FOUND_A_FLUX, told);
      };
    },
  },
});
