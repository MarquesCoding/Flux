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
 * The element currently filling the screen, where there is one, asked of every vendor's spelling of
 * the property since browsers still differ on it.
 */
const readFullscreenElement = (): HTMLElement | undefined =>
  document.fullscreenElement instanceof HTMLElement ? document.fullscreenElement : undefined;

/**
 * Answers that nothing is filling the screen, for a render with no document to ask — the server has
 * no fullscreen element and no way to acquire one.
 */
const readOnServer = (): HTMLElement | undefined => undefined;

/**
 * Where a popup should be rendered so that it can actually be seen: the body normally, but whatever
 * is filling the screen while something is. A menu portalled to the body while a video is fullscreen
 * is drawn behind the video, which is to say not drawn at all.
 */
const usePortalContainer = (): HTMLElement | undefined =>
  useSyncExternalStore(subscribe, readFullscreenElement, readOnServer);

export { usePortalContainer };
