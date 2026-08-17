import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BackdropScrim } from './BackdropScrim';

const scrimIn = (container: HTMLElement): HTMLElement => {
  const found = container.firstElementChild;

  if (!(found instanceof HTMLElement)) {
    throw new Error('The scrim did not render.');
  }

  return found;
};

describe('BackdropScrim', () => {
  it('fades to the colour of the panel it meets, not to the page behind it', () => {
    const { container } = render(<BackdropScrim />);

    expect(scrimIn(container).className).toContain('from-surface-raised');
    expect(scrimIn(container).className).not.toContain('from-surface ');
  });

  it('reaches past its container, so no sliver of artwork survives the join', () => {
    const { container } = render(<BackdropScrim />);

    expect(scrimIn(container).className).toContain('-bottom-px');
  });

  it('reaches its weight low down, where the title sits, rather than halfway up', () => {
    const { container } = render(<BackdropScrim />);

    expect(scrimIn(container).className).toContain('via-35%');
    expect(scrimIn(container).className).toContain('via-surface-raised/60');
  });

  it('is scenery rather than something to read or press', () => {
    const { container } = render(<BackdropScrim />);

    expect(scrimIn(container)).toHaveAttribute('aria-hidden');
    expect(scrimIn(container).className).toContain('pointer-events-none');
  });

  it('takes extra classes for a caller that needs a different depth', () => {
    const { container } = render(<BackdropScrim className="h-1/2" />);

    expect(scrimIn(container).className).toContain('h-1/2');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(BackdropScrim.displayName).toBe('BackdropScrim');
  });
});
