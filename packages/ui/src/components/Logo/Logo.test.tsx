import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';

/**
 * The box the mark is drawn in, which is the element taking the size.
 *
 * @param container - What was rendered.
 * @returns The box.
 */
const boxOf = (container: HTMLElement): HTMLElement => {
  const box = container.querySelector('span');

  if (box === null) {
    throw new Error('The logo drew nothing.');
  }

  return box;
};

/**
 * A layer cut to the shape of the mark, of which there is one for the ink and, where the mark is
 * edged, another beneath it for the keyline.
 *
 * @param container - What was rendered.
 * @returns Every layer carrying the mask.
 */
const layersOf = (container: HTMLElement): HTMLElement[] =>
  [...container.querySelectorAll('span')].filter((span) => span.style.maskImage !== '');

describe('Logo', () => {
  it('says what it is where it stands for the whole name', () => {
    render(<Logo label="Valence" />);

    expect(screen.getByRole('img', { name: 'Valence' })).toBeInTheDocument();
  });

  it('is hidden from anything reading the page where a name sits beside it', () => {
    const { container } = render(<Logo />);

    expect(boxOf(container)).toHaveAttribute('aria-hidden', 'true');
  });

  it('cuts the mark out of whatever is painted behind it', () => {
    const { container } = render(<Logo />);

    expect(layersOf(container)).toHaveLength(1);
    expect(layersOf(container)[0]?.style.maskImage).toContain('valence-logo.svg');
  });

  it('lays a second copy of the mark behind it to draw a keyline, and hides it otherwise', () => {
    const { container: edged } = render(<Logo hasEdge />);
    const { container: plain } = render(<Logo />);

    expect(layersOf(edged)).toHaveLength(2);
    expect(edged.innerHTML).toContain('flux-logo-edge');
    expect(plain.innerHTML).not.toContain('flux-logo-edge');
  });

  it('gives an edged mark a solid body, since a keyline behind dots would show through', () => {
    const { container: edged } = render(<Logo isDotted hasEdge />);
    const { container: plain } = render(<Logo isDotted />);

    expect(edged.innerHTML).toContain('bg-surface');
    expect(plain.innerHTML).not.toContain('bg-surface');
  });

  it('takes the size it is given, and leaves it to the class where it is not', () => {
    const { container: sized } = render(<Logo size={64} />);
    const { container: free } = render(<Logo className="h-[0.72em]" />);

    expect(boxOf(sized).style.height).toBe('64px');
    expect(boxOf(free).style.height).toBe('');
  });

  it('fills itself with dots where asked, inside the shape it is cut to', () => {
    const { container } = render(<Logo isDotted />);

    expect(container.innerHTML).toContain('flux-logo-dots');
    expect(layersOf(container)[0]?.style.maskImage).toContain('valence-logo.svg');
  });

  it('is solid ink otherwise, since dots turn to mush at the size of a dock', () => {
    const { container } = render(<Logo />);

    expect(container.innerHTML).not.toContain('flux-logo-dots');
    expect(container.innerHTML).toContain('conic-gradient');
  });

  it('sends a wave through the dots only where the mark is both dotted and alive', () => {
    const { container: still } = render(<Logo isDotted />);
    const { container: waving } = render(<Logo isDotted isAnimated />);

    expect(still.innerHTML).not.toContain('flux-logo-wave');
    expect(waving.innerHTML).toContain('flux-logo-wave');
  });

  it('keeps its colour when it is made of dots, since dots are still the mark', () => {
    const { container } = render(<Logo isDotted />);

    expect(container.innerHTML).toContain('conic-gradient');
  });

  it('turns the gradient for a solid mark and waves for a dotted one, never both', () => {
    const { container: solid } = render(<Logo isAnimated />);
    const { container: dotted } = render(<Logo isDotted isAnimated />);

    expect(solid.innerHTML).toContain('animate-');
    expect(dotted.innerHTML).not.toContain('animate-[spin');
  });

  it('holds still where nobody is waiting on it', () => {
    const { container } = render(<Logo />);

    expect(container.innerHTML).not.toContain('animate-');
    expect(container.innerHTML).not.toContain('flux-logo-wave');
  });
});

describe('the shape of the mark', () => {
  it('is drawn to its own proportions rather than squared off', () => {
    const { container } = render(<Logo size={100} />);
    const held = container.firstElementChild;

    expect(held).toHaveStyle({ height: '100px' });
    expect(held).not.toHaveStyle({ width: '100px' });
  });

  it('holds its proportions where a class sets the size instead', () => {
    const { container } = render(<Logo className="h-8" />);

    expect(container.firstElementChild).toHaveStyle({ aspectRatio: String(624 / 458) });
  });
});
