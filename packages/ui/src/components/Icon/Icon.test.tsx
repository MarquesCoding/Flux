import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Home01Icon, PauseIcon, PlayIcon } from '@hugeicons/core-free-icons';
import { Icon } from './Icon';

/**
 * The drawing an icon rendered as.
 *
 * @param container - What was rendered.
 * @returns The drawing.
 */
const glyphOf = (container: HTMLElement): SVGSVGElement => {
  const glyph = container.querySelector('svg');

  if (glyph === null) {
    throw new Error('The icon drew nothing.');
  }

  return glyph;
};

describe('Icon', () => {
  it('draws the icon it was given', () => {
    const { container } = render(<Icon of={Home01Icon} />);

    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('is hidden from anything reading the page, since a glyph beside a label says nothing', () => {
    const { container } = render(<Icon of={Home01Icon} />);

    expect(glyphOf(container)).toHaveAttribute('aria-hidden', 'true');
  });

  it('says what it means where it stands on its own', () => {
    render(<Icon of={Home01Icon} label="Home" />);

    expect(screen.getByRole('img', { name: 'Home' })).toBeInTheDocument();
  });

  it('takes the size it is asked for, in rem, so it grows with the text on a large screen', () => {
    const { container } = render(<Icon of={Home01Icon} size={32} />);

    expect(glyphOf(container)).toHaveAttribute('width', '2rem');
    expect(glyphOf(container)).toHaveAttribute('height', '2rem');
  });

  it('draws at the size of body text where no size is asked for', () => {
    const { container } = render(<Icon of={Home01Icon} />);

    expect(glyphOf(container)).toHaveAttribute('width', '1.125rem');
  });

  it("draws its line a little heavier than the set's own, so it holds over artwork", () => {
    const { container } = render(<Icon of={Home01Icon} />);

    expect(container.innerHTML).toContain('stroke-width="1.75"');
  });

  it('draws a thing in force with a heavier line, as a second cue beside its control', () => {
    const { container: quiet } = render(<Icon of={Home01Icon} />);
    const { container: loud } = render(<Icon of={Home01Icon} isActive />);

    expect(loud.innerHTML).toContain('stroke-width="2.25"');
    expect(quiet.innerHTML).not.toBe(loud.innerHTML);
  });

  it('carries the class the stylesheet knows every glyph by', () => {
    const { container } = render(<Icon of={Home01Icon} />);

    expect(glyphOf(container)).toHaveClass('valence-icon');
  });

  it('keeps the classes a caller gave it as well', () => {
    const { container } = render(<Icon of={Home01Icon} className="text-red-500" />);

    expect(glyphOf(container)).toHaveClass('valence-icon', 'text-red-500');
  });

  it('draws the other icon instead while what it stands for is in force', () => {
    const { container: off } = render(<Icon of={PlayIcon} whenActive={PauseIcon} />);
    const { container: on } = render(<Icon of={PlayIcon} whenActive={PauseIcon} isActive />);
    const { container: pause } = render(<Icon of={PauseIcon} isActive />);

    expect(off.innerHTML).not.toBe(on.innerHTML);
    expect(on.querySelector('path')?.getAttribute('d')).toBe(
      pause.querySelector('path')?.getAttribute('d'),
    );
  });

  it('swaps the drawing in place rather than drawing the two side by side', () => {
    const { container } = render(<Icon of={PlayIcon} whenActive={PauseIcon} isActive />);

    expect(container.querySelectorAll('svg')).toHaveLength(1);
  });

  it('sets a display name so devtools can identify it', () => {
    expect(Icon.displayName).toBe('Icon');
  });
});
