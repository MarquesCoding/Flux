import type { DeviceStore } from '@ValenceClient/platform/Platform.types';

const WAS = 'flux.';

const IS = 'valence.';

const KEPT_UNDER = [
  'captionStyle',
  'clientId',
  'gridSize',
  'library.last',
  'playback',
  'profile',
  'qualityPreference',
  'reader',
  'server.address',
  'soundPreference',
] as const;

/**
 * Moves what this device already remembers to the names it is remembered under now.
 *
 * These keys are the one part of a rename that is not ours to change freely: they are written into
 * somebody's machine, and the value is only reachable through the name it was written under. Renamed
 * without this, every one of them reads as absent — which does not fail, it silently resets. Somebody
 * opens a version that is meant only to look different and finds their captions restyled, their grid
 * back to the default, their server forgotten, and their device introducing itself to the sessions
 * list as a stranger.
 *
 * A key already carried over is left alone, so this can run on every start and only does anything on
 * the first. The old name is forgotten once the new one holds the value, which is what stops it
 * running for ever and what makes a later downgrade honest about what it has lost.
 *
 * @param store - Where this device keeps what it remembers.
 * @returns Which keys were carried over, for anybody who wants to say so.
 */
const carryOldKeysOver = (store: DeviceStore): string[] => {
  const carried: string[] = [];

  for (const name of KEPT_UNDER) {
    const was = `${WAS}${name}`;
    const held = store.read(was);

    if (held === null) {
      continue;
    }

    if (store.read(`${IS}${name}`) === null) {
      store.write(`${IS}${name}`, held);
      carried.push(name);
    }

    store.forget(was);
  }

  return carried;
};

export { IS, KEPT_UNDER, WAS, carryOldKeysOver };
