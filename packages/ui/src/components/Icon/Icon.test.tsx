import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Home01Icon, Tv01Icon } from '@hugeicons/core-free-icons';
import { Icon } from './Icon';

describe('Icon', () => {
  it('draws the icon it was given', () => {
    const { container } = render(<Icon of={Home01Icon} />);

    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('is hidden from anything reading the page, since a glyph beside a label says nothing', () => {
    const { container } = render(<Icon of={Home01Icon} />);

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('says what it means where it stands on its own', () => {
    render(<Icon of={Home01Icon} label="Home" />);

    expect(screen.getByRole('img', { name: 'Home' })).toBeInTheDocument();
  });

  it('takes the size it is asked for', () => {
    const { container } = render(<Icon of={Home01Icon} size={32} />);

    expect(container.querySelector('svg')).toHaveAttribute('width', '32');
  });

  it('draws a thing in force more heavily, since the free set has no filled twin', () => {
    const { container: quiet } = render(<Icon of={Home01Icon} />);
    const { container: loud } = render(<Icon of={Home01Icon} isActive />);

    const strokeOf = (held: HTMLElement) =>
      Number(held.querySelector('svg')?.getAttribute('stroke-width') ?? '0');

    expect(strokeOf(loud)).toBeGreaterThan(strokeOf(quiet));
  });

  it('lets a caller set the weight itself, which overrides both', () => {
    const { container } = render(<Icon of={Home01Icon} isActive strokeWidth={1} />);

    expect(container.querySelector('svg')).toHaveAttribute('stroke-width', '1');
  });

  it('draws the other icon instead while what it stands for is in force', () => {
    const { container: off } = render(<Icon of={Home01Icon} whenActive={Tv01Icon} />);
    const { container: on } = render(<Icon of={Home01Icon} whenActive={Tv01Icon} isActive />);

    expect(off.innerHTML).not.toBe(on.innerHTML);
  });
});
