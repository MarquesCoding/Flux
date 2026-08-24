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

    expect(scrimIn(container).className).toContain('valence-artwork-veil--raised');
  });

  it('darkens the artwork the same way whichever theme is on, since it is over a picture', () => {
    const { container } = render(<BackdropScrim />);

    expect(scrimIn(container).className).toContain('valence-artwork-veil--raised');
  });

  it('reaches past its container, so no sliver of artwork survives the join', () => {
    const { container } = render(<BackdropScrim />);

    expect(scrimIn(container).className).toContain('-bottom-px');
  });

  it('keeps the darkening and the blend as separate layers, so neither can wash the other out', () => {
    const { container } = render(<BackdropScrim />);

    const painted = scrimIn(container).className;

    expect(painted).toContain('valence-artwork-veil--raised');
    expect(painted).not.toContain('valence-artwork-blend--raised ');
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
