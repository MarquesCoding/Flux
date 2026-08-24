import type { HeldFile, WhatToKeep } from '@ValenceContracts/schemas/HeldFile';
import type { HeldFiles } from '@ValenceClient/platform/Platform.types';

type FakeHeldFiles = {
  held: HeldFiles;
  put: (files: HeldFile[]) => void;
  asked: WhatToKeep[];
  dropped: string[];
  paused: [string, boolean][];
};

/**
 * Somewhere files are kept, which a test can move around under a screen.
 *
 * A held file is the one thing on screen that no server decides. It arrives from the host, changes
 * while somebody is looking at it, and has to keep changing when there is no server at all — so a
 * test that wants to know what a shelf of downloads looks like halfway through a transfer needs to
 * be able to say so directly.
 *
 * @param starting - What is on the disk to begin with.
 * @returns Somewhere to keep files, and the handles to move it.
 */
const aFakeHeldFiles = (starting: HeldFile[] = []): FakeHeldFiles => {
  const listeners = new Set<(held: HeldFile[]) => void>();

  const asked: WhatToKeep[] = [];
  const dropped: string[] = [];
  const paused: [string, boolean][] = [];

  let files = starting;

  const put = (nowHeld: HeldFile[]): void => {
    files = nowHeld;

    for (const listener of listeners) {
      listener(nowHeld);
    }
  };

  return {
    asked,
    dropped,
    paused,
    put,
    held: {
      all: () => Promise.resolve(files),
      keep: (what) => {
        asked.push(what);

        return Promise.resolve();
      },
      drop: (downloadId) => {
        dropped.push(downloadId);
        put(files.filter((file) => file.downloadId !== downloadId));

        return Promise.resolve();
      },
      pause: (downloadId, isPaused) => {
        paused.push([downloadId, isPaused]);

        return Promise.resolve();
      },
      sourceFor: (downloadId) => `/held/${downloadId}`,
      posterFor: (downloadId) => `/held/${downloadId}/poster`,
      whenChanged: (listener) => {
        listeners.add(listener);

        return () => {
          listeners.delete(listener);
        };
      },
    },
  };
};

export type { FakeHeldFiles };

export { aFakeHeldFiles };
