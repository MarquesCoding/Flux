import { useEffect, useState } from 'react';

const BESIDE_FROM = '(min-width: 40rem)';

/**
 * Whether there is room to stand one panel beside another, which is the small breakpoint and nothing
 * more.
 *
 * Asked in script rather than written as a class because the thing it decides is animated, and an
 * animated width is an inline style that no breakpoint can reach. A companion column given
 * `min(26rem, 40vw)` on a phone is 156px of sliver — the row stacks correctly and the width does not
 * follow it.
 *
 * Answers `true` where there is no `matchMedia` to ask, since a server rendering a page and a test
 * environment are both better served by the arrangement that has room than by one that assumes a
 * phone.
 *
 * @returns Whether a second panel fits beside the first.
 */
const useRoomBeside = (): boolean => {
  const [hasRoom, setHasRoom] = useState(() =>
    typeof window === 'undefined' || typeof window.matchMedia !== 'function'
      ? true
      : window.matchMedia(BESIDE_FROM).matches,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const asked = window.matchMedia(BESIDE_FROM);

    const answer = (): void => {
      setHasRoom(asked.matches);
    };

    answer();

    asked.addEventListener('change', answer);

    return () => {
      asked.removeEventListener('change', answer);
    };
  }, []);

  return hasRoom;
};

export { useRoomBeside };
