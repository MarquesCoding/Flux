import { platformInUse } from '@FluxClient/platform/installPlatform';

const KEY = 'flux.server.address';

/**
 * Reads the server a client with a window of its own was told to watch.
 *
 * A browser never asks: its pages came from the server. A client with a window of its own is asked
 * once, before it has anything to show, and the answer is what its window then opens on — see
 * ADR-0026.
 *
 * @returns The address, or nothing where this client has not been told one.
 */
const serverAddress = (): string | null => {
  const held = platformInUse().store.read(KEY);

  return held === null || held === '' ? null : held;
};

/**
 * Remembers the server a viewer named, so they are asked once rather than at every launch.
 *
 * @param address - Where their Valence is, or nothing to forget it.
 */
const rememberServerAddress = (address: string | null): void => {
  if (address === null || address === '') {
    platformInUse().store.forget(KEY);

    return;
  }

  platformInUse().store.write(KEY, address);
};

export { rememberServerAddress, serverAddress };
