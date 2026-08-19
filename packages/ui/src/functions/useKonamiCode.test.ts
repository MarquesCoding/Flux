import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useKonamiCode } from './useKonamiCode';

const CODE = [
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
];

/**
 * Presses keys at whatever is given, or at the page when nothing is.
 *
 * @param keys - The keys to press, in order.
 * @param target - What to press them at.
 */
const press = (keys: string[], target: EventTarget = window) => {
  for (const key of keys) {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }
};

describe('useKonamiCode', () => {
  it('calls back once the whole code has been entered', () => {
    const onEntered = vi.fn();

    renderHook(() => {
      useKonamiCode(onEntered);
    });
    press(CODE);

    expect(onEntered).toHaveBeenCalledTimes(1);
  });

  it('says nothing until the last key of it', () => {
    const onEntered = vi.fn();

    renderHook(() => {
      useKonamiCode(onEntered);
    });
    press(CODE.slice(0, -1));

    expect(onEntered).not.toHaveBeenCalled();
  });

  it('takes the code twice over', () => {
    const onEntered = vi.fn();

    renderHook(() => {
      useKonamiCode(onEntered);
    });
    press([...CODE, ...CODE]);

    expect(onEntered).toHaveBeenCalledTimes(2);
  });

  it('does not mind which case the letters are typed in', () => {
    const onEntered = vi.fn();

    renderHook(() => {
      useKonamiCode(onEntered);
    });
    press([...CODE.slice(0, -2), 'B', 'A']);

    expect(onEntered).toHaveBeenCalled();
  });

  it('starts again after a wrong key', () => {
    const onEntered = vi.fn();

    renderHook(() => {
      useKonamiCode(onEntered);
    });
    press(['ArrowUp', 'ArrowDown', ...CODE]);

    expect(onEntered).toHaveBeenCalledTimes(1);
  });

  it('counts a first key that arrives while the sequence is part-entered', () => {
    const onEntered = vi.fn();

    renderHook(() => {
      useKonamiCode(onEntered);
    });
    press(['ArrowDown', 'ArrowUp', ...CODE.slice(1)]);

    expect(onEntered).toHaveBeenCalledTimes(1);
  });

  it('ignores somebody typing into a field, however tempting what they typed was', () => {
    const onEntered = vi.fn();
    const field = document.createElement('input');

    document.body.append(field);

    renderHook(() => {
      useKonamiCode(onEntered);
    });
    press(CODE, field);

    expect(onEntered).not.toHaveBeenCalled();

    field.remove();
  });

  it('ignores anything being written in, field or not', () => {
    const onEntered = vi.fn();
    const note = document.createElement('div');

    note.contentEditable = 'true';
    Object.defineProperty(note, 'isContentEditable', { configurable: true, value: true });
    document.body.append(note);

    renderHook(() => {
      useKonamiCode(onEntered);
    });
    press(CODE, note);

    expect(onEntered).not.toHaveBeenCalled();

    note.remove();
  });

  it('loses its place when somebody starts typing part way through', () => {
    const onEntered = vi.fn();
    const field = document.createElement('input');

    document.body.append(field);

    renderHook(() => {
      useKonamiCode(onEntered);
    });
    press(CODE.slice(0, 4));
    press(['x'], field);
    press(CODE.slice(4));

    expect(onEntered).not.toHaveBeenCalled();

    field.remove();
  });

  it('calls back with what it was last given rather than what it was first given', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ onEntered }: { onEntered: () => void }) => {
        useKonamiCode(onEntered);
      },
      { initialProps: { onEntered: first } },
    );

    rerender({ onEntered: second });
    press(CODE);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops listening once it is gone', () => {
    const onEntered = vi.fn();
    const { unmount } = renderHook(() => {
      useKonamiCode(onEntered);
    });

    unmount();
    press(CODE);

    expect(onEntered).not.toHaveBeenCalled();
  });
});
