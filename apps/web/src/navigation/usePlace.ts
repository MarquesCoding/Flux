import { useCallback, useEffect, useState } from 'react';
import { readLocation, writeLocation } from './readLocation';
import type { Place } from './readLocation';

/**
 * Where the application is, kept in the address bar rather than in state, so that every place in Flux
 * is somewhere the browser can go back to, reload into, or have a link sent to.
 */
const usePlace = (): {
  place: Place;
  go: (change: Partial<Place>) => void;
  replace: (change: Partial<Place>) => void;
} => {
  const [place, setPlace] = useState<Place>(() =>
    readLocation(typeof window === 'undefined' ? '/' : window.location.href),
  );

  useEffect(() => {
    const onPopState = () => {
      setPlace(readLocation(window.location.href));
    };

    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  const move = useCallback((change: Partial<Place>, isReplacing: boolean) => {
    setPlace((current) => {
      const next = { ...current, ...change };
      const address = writeLocation(next);

      if (address !== `${window.location.pathname}${window.location.search}`) {
        if (isReplacing) {
          window.history.replaceState(null, '', address);
        } else {
          window.history.pushState(null, '', address);
        }
      }

      return next;
    });
  }, []);

  return {
    place,
    go: useCallback(
      (change: Partial<Place>) => {
        move(change, false);
      },
      [move],
    ),
    replace: useCallback(
      (change: Partial<Place>) => {
        move(change, true);
      },
      [move],
    ),
  };
};

export { usePlace };
