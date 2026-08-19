import { useEffect, useRef, useState } from 'react';
import type { DotFieldFilm, DotFieldFrame } from '@FluxUI/DotField.types';

const TAIL = 0.25;

/**
 * Fetches a film the moment it is asked for and hands back the frame source to play it with, so
 * that the field of dots already on the page becomes the screen it plays on. Nobody who has not
 * found it pays for it: until somebody does, the film is not fetched at all.
 *
 * Escape ends it, as does the film reaching its end. Whoever shows this is expected to put a way
 * out on screen as well, because Escape is no help at all to somebody holding a phone, and an
 * easter egg somebody cannot get out of is a fault rather than a joke.
 *
 * @param isPlaying - Whether it is playing.
 * @param onEnd - What to do when it stops, however it stopped.
 * @returns Where to read each frame from, or nothing while there is no film to play.
 */
const useDotFilm = (isPlaying: boolean, onEnd: () => void): DotFieldFrame | null => {
  const [film, setFilm] = useState<DotFieldFilm | null>(null);
  const endRef = useRef(onEnd);

  endRef.current = onEnd;

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    let wanted = true;

    void import('@FluxUI/badAppleFilm')
      .then(async (loaded) => loaded.loadBadAppleFilm())
      .then((loaded) => {
        if (wanted) {
          setFilm(loaded);
        }
      })
      .catch(() => {
        endRef.current();
      });

    return () => {
      wanted = false;
    };
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying || film === null) {
      return;
    }

    const timer = setTimeout(
      () => {
        endRef.current();
      },
      (film.seconds + TAIL) * 1000,
    );

    return () => {
      clearTimeout(timer);
    };
  }, [isPlaying, film]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const hear = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        endRef.current();
      }
    };

    window.addEventListener('keydown', hear);

    return () => {
      window.removeEventListener('keydown', hear);
    };
  }, [isPlaying]);

  return isPlaying && film !== null ? film.lift : null;
};

export { useDotFilm };
