import { useSyncExternalStore } from 'react';

/**
 * Watches for the page entering or leaving fullscreen.
 */
const subscribe = (onChange: () => void): (() => void) => {
  document.addEventListener('fullscreenchange', onChange);

  return () => {
    document.removeEventListener('fullscreenchange', onChange);
  };
};

/**
 * The element currently filling the screen, where there is one.
 *
 * Narrowed rather than asserted: `fullscreenElement` is an `Element`, which
 * includes SVG, and a portal container has to be an `HTMLElement`. Anything
 * else is treated as no container, which is the safe direction — the popup
 * goes back to the body rather than into something that cannot host it.
 */
const readFullscreenElement = (): HTMLElement | undefined =>
  document.fullscreenElement instanceof HTMLElement ? document.fullscreenElement : undefined;

/**
 * Nothing is fullscreen where there is no document to ask.
 */
const readOnServer = (): HTMLElement | undefined => undefined;

/**
 * Where a popup should be rendered so that it can actually be seen.
 *
 * Every popup in FluxUI portals out of the tree that opened it, which is
 * right for stacking and wrong for fullscreen. A browser showing an element
 * fullscreen paints that element's subtree and nothing else, so a menu
 * portalled to `document.body` is positioned correctly, exists in the DOM,
 * and is never drawn. No amount of `z-index` reaches it: nothing in the page
 * is above the fullscreen element.
 *
 * That made every choice the player offers — audio track, quality, episode,
 * settings — unreachable in the mode most people watch in.
 *
 * Read from the document rather than provided by whatever went fullscreen.
 * A context would have to be threaded through every caller and would still
 * miss the case that matters most: a dialog opened from a fullscreen player
 * is not inside the player's tree, and would be exactly as invisible. The
 * document already knows the answer, and it is the same answer for
 * everybody.
 *
 * Undefined means no container, which is what Base UI already does — the
 * body. So this changes nothing at all until something is fullscreen, and
 * puts every popup back on the way out.
 */
const usePortalContainer = (): HTMLElement | undefined =>
  useSyncExternalStore(subscribe, readFullscreenElement, readOnServer);

export { usePortalContainer };
