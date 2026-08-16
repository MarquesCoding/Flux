import { useSyncExternalStore } from 'react';

/**
 * Subscribes to the page entering or leaving fullscreen, so anything portalled can be told to move.
 *
 * @param onChange - Told whenever the fullscreen element changes.
 * @returns The function that stops watching.
 */
const subscribe = (onChange: () => void): (() => void) => {
  document.addEventListener('fullscreenchange', onChange);

  return () => {
    document.removeEventListener('fullscreenchange', onChange);
  };
};

/**
 * The element currently filling the screen, where there is one.
 */
const readFullscreenElement = (): HTMLElement | undefined =>
  document.fullscreenElement instanceof HTMLElement ? document.fullscreenElement : undefined;

/**
 * Nothing is fullscreen where there is no document to ask.
 */
const readOnServer = (): HTMLElement | undefined => undefined;

/**
 * Where a popup should be rendered so that it can actually be seen.
 */
const usePortalContainer = (): HTMLElement | undefined =>
  useSyncExternalStore(subscribe, readFullscreenElement, readOnServer);

export { usePortalContainer };
