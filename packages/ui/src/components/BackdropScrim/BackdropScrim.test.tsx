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
  it('does not fade the picture into the panel, there being no one colour glass is', () => {
    const { container } = render(<BackdropScrim />);

    expect(scrimIn(container).className).not.toContain('--raised');
  });

  it('darkens the artwork the same way whichever theme is on, since it is over a picture', () => {
    const { container } = render(<BackdropScrim />);

    expect(scrimIn(container).className).toContain('valence-artwork-scrim');
  });

  it('takes the same box as the picture, so its edges are not their own to draw a line along', () => {
    const { container } = render(<BackdropScrim />);

    const painted = scrimIn(container).className;

    expect(painted).toContain('inset-0');
    expect(painted).not.toContain('h-2/3');
  });

  it('paints nothing that carries the page palette, so the light theme cannot wash it out', () => {
    const { container } = render(<BackdropScrim />);

    const painted = scrimIn(container).className;

    expect(painted).toContain('valence-artwork-scrim');
    expect(painted).not.toContain('valence-artwork-blend--raised');
  });

  it('takes the side darkening to the corner, so a scrim over part of a picture draws no line', () => {
    const { container } = render(<BackdropScrim />);

    expect(scrimIn(container).className).toContain('valence-artwork-scrim--foot');
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
