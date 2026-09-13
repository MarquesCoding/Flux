import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WindowBar } from './WindowBar';

describe('WindowBar', () => {
  it('gives a frameless window somewhere to be picked up by', () => {
    const { container } = render(<WindowBar />);

    expect(container.querySelector('[data-slot="window-bar"]')).toBeInTheDocument();
  });

  it('draws nothing, because everything it used to say the page says better', () => {
    render(<WindowBar />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('is hidden from anybody listening rather than read out as an empty region', () => {
    const { container } = render(<WindowBar />);

    expect(container.querySelector('[data-slot="window-bar"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('lies over the page rather than taking height from it', () => {
    const { container } = render(<WindowBar />);

    expect(container.querySelector('[data-slot="window-bar"]')).toHaveClass('fixed', 'top-0');
  });

  it('takes hold of the window it is laid over', () => {
    const { container } = render(<WindowBar />);

    expect(container.querySelector('[data-slot="window-bar"]')).toHaveClass(
      '[-webkit-app-region:drag]',
    );
  });

  it('can be made deeper where the top of a page would otherwise be the only handle', () => {
    const { container } = render(<WindowBar height="4rem" />);

    expect(container.querySelector('[data-slot="window-bar"]')).toHaveStyle({ height: '64px' });
  });
});
