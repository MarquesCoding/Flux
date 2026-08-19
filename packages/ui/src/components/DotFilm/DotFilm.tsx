import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { DotField } from '@FluxUI/DotField';
import type { DotFieldFilm } from '@FluxUI/DotField.types';
import type { DotFilmProps } from './DotFilm.types';

const SPACING = 10;

const FADING = 1.2;

const TAIL = 0.25;

/**
 * Plays a film on the background dots, over a page that fades out behind it. The dots are the only
 * screen it has: a silhouette is two states and so is a dot, which is why this is the one kind of
 * film that plays on a thing like this at all.
 *
 * The film itself is fetched the moment it is asked for and never before, so nobody who has not
 * found this pays for it. Anything at all ends it — a key, a tap, or the film reaching its end —
 * because an easter egg that somebody cannot get out of is a fault rather than a joke.
 *
 * @param isPlaying - Whether it is playing.
 * @param onEnd - What to do when it stops, however it stopped.
 */
const DotFilm = ({ isPlaying, onEnd }: DotFilmProps) => {
  const prefersReducedMotion = useReducedMotion();
  const [film, setFilm] = useState<DotFieldFilm | null>(null);
  const endRef = useRef(onEnd);

  endRef.current = onEnd;

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    let wanted = true;

    void import('@FluxUI/silhouetteFilm')
      .then((loaded) => {
        if (wanted) {
          setFilm(loaded.silhouetteFilm);
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

    const stop = () => {
      endRef.current();
    };

    window.addEventListener('keydown', stop);
    window.addEventListener('pointerdown', stop);

    return () => {
      window.removeEventListener('keydown', stop);
      window.removeEventListener('pointerdown', stop);
    };
  }, [isPlaying]);

  return (
    <AnimatePresence>
      {isPlaying ? (
        <motion.div
          key="dot-film"
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: prefersReducedMotion === true ? 0 : FADING,
            ease: 'easeInOut',
          }}
          className="fixed inset-0 z-50 bg-black text-white"
        >
          {film === null ? null : <DotField spacing={SPACING} frame={film.lift} />}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

DotFilm.displayName = 'DotFilm';

export { DotFilm };
