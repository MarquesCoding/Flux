import { contextBridge, ipcRenderer } from 'electron';
import { z } from 'zod';
import { FORGET_ONE, READ_EVERYTHING, WRITE_ONE } from '@FluxDesktop/main/preferenceChannels';

const HeldSchema = z.record(z.string(), z.string()).catch({});

const held = HeldSchema.parse(ipcRenderer.sendSync(READ_EVERYTHING));

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
});
