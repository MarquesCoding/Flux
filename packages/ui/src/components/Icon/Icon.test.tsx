import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HouseIcon, TelevisionIcon } from '@phosphor-icons/react';
import { Icon } from './Icon';

describe('Icon', () => {
  it('draws the icon it was given', () => {
    const { container } = render(<Icon of={HouseIcon} />);

    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('is hidden from anything reading the page, since a glyph beside a label says nothing', () => {
    const { container } = render(<Icon of={HouseIcon} />);

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('says what it means where it stands on its own', () => {
    render(<Icon of={HouseIcon} label="Home" />);

    expect(screen.getByRole('img', { name: 'Home' })).toBeInTheDocument();
  });

  it('takes the size it is asked for', () => {
    const { container } = render(<Icon of={HouseIcon} size={32} />);

    expect(container.querySelector('svg')).toHaveAttribute('width', '32');
  });

  it('fills a thing in force, which is how a glyph says it is on', () => {
    const { container: quiet } = render(<Icon of={HouseIcon} />);
    const { container: loud } = render(<Icon of={HouseIcon} isActive />);

    expect(quiet.innerHTML).not.toBe(loud.innerHTML);
  });

  it('draws a resting glyph boldly, since a hairline reads as unfinished over artwork', () => {
    const { container: resting } = render(<Icon of={HouseIcon} />);
    const { container: thin } = render(<Icon of={HouseIcon} weight="thin" />);

    expect(resting.innerHTML).not.toBe(thin.innerHTML);
  });

  it('still draws duotone for a caller that asks for it', () => {
    const { container } = render(<Icon of={HouseIcon} weight="duotone" />);

    expect(container.querySelector('svg')?.innerHTML).toContain('opacity');
  });

  it('carries the class that decides how strong the second tone is', () => {
    const { container } = render(<Icon of={HouseIcon} />);

    expect(container.querySelector('svg')).toHaveClass('valence-icon');
  });

  it('keeps the classes a caller gave it as well', () => {
    const { container } = render(<Icon of={HouseIcon} className="text-red-500" />);

    expect(container.querySelector('svg')).toHaveClass('valence-icon', 'text-red-500');
  });

  it('draws any other weight a caller asks for', () => {
    const { container: thin } = render(<Icon of={HouseIcon} weight="thin" />);
    const { container: resting } = render(<Icon of={HouseIcon} />);

    expect(thin.innerHTML).not.toBe(resting.innerHTML);
  });

  it('lets a caller set the weight itself, which overrides being in force', () => {
    const { container: told } = render(<Icon of={HouseIcon} isActive weight="thin" />);
    const { container: filled } = render(<Icon of={HouseIcon} isActive />);

    expect(told.innerHTML).not.toBe(filled.innerHTML);
  });

  it('draws the other icon instead while what it stands for is in force', () => {
    const { container: off } = render(<Icon of={HouseIcon} whenActive={TelevisionIcon} />);
    const { container: on } = render(<Icon of={HouseIcon} whenActive={TelevisionIcon} isActive />);

    expect(off.innerHTML).not.toBe(on.innerHTML);
  });
});
