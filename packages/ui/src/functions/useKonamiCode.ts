import { useEffect, useRef } from 'react';

const SEQUENCE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
] as const;

/**
 * Whether the key that was pressed went into something somebody is writing in, in which case it is
 * a letter of what they are typing rather than a move in a game. Searching for a film called
 * "Bad Apple" would otherwise be a way to trip this by accident.
 *
 * @param target - What the key press landed on.
 * @returns Whether to leave it alone.
 */
const isWriting = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
};

/**
 * Listens for the Konami code — up, up, down, down, left, right, left, right, B, A — and calls back
 * once it has been entered in full. A wrong key starts the sequence again rather than ending it, so
 * a press of up after three wrong ones counts as the first of the ten and not a failure.
 *
 * @param onEntered - What to do once the whole sequence has been entered.
 */
const useKonamiCode = (onEntered: () => void): void => {
  const atRef = useRef(0);
  const enteredRef = useRef(onEntered);

  enteredRef.current = onEntered;

  useEffect(() => {
    const hear = (event: KeyboardEvent) => {
      if (isWriting(event.target)) {
        atRef.current = 0;

        return;
      }

      const pressed = event.key.length === 1 ? event.key.toLowerCase() : event.key;

      if (pressed !== SEQUENCE[atRef.current]) {
        atRef.current = pressed === SEQUENCE[0] ? 1 : 0;

        return;
      }

      atRef.current += 1;

      if (atRef.current === SEQUENCE.length) {
        atRef.current = 0;
        enteredRef.current();
      }
    };

    window.addEventListener('keydown', hear);

    return () => {
      window.removeEventListener('keydown', hear);
    };
  }, []);
};

export { useKonamiCode };
