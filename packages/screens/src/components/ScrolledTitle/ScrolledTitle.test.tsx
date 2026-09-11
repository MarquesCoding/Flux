import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScrolledTitle } from './ScrolledTitle';

/**
 * The bar itself: the part that is drawn, rather than the sticky box it hangs from.
 */
const bar = () => screen.getByText('Arrival').closest('[aria-hidden]');

describe('ScrolledTitle', () => {
  it('says what the dialog is about', () => {
    render(<ScrolledTitle title="Arrival" isShowing />);

    expect(screen.getByText('Arrival')).toBeInTheDocument();
  });

  it('draws the artwork beside the title where there is some', () => {
    const { container } = render(<ScrolledTitle title="Arrival" artwork="/poster.jpg" isShowing />);

    expect(container.querySelector('img')).toHaveAttribute('src', '/poster.jpg');
  });

  it('leaves the artwork out where there is none', () => {
    const { container } = render(<ScrolledTitle title="Arrival" artwork={null} isShowing />);

    expect(container.querySelector('img')).toBeNull();
  });

  it('carries a line beneath the title where one is given', () => {
    render(<ScrolledTitle title="Arrival" detail="8 episodes" isShowing />);

    expect(screen.getByText('8 episodes')).toBeInTheDocument();
  });

  it('keeps the controls the heading carried, at its right', () => {
    render(
      <ScrolledTitle title="Arrival" isShowing>
        <span>Close</span>
      </ScrolledTitle>,
    );

    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('stays out of the way until the heading has been scrolled past', () => {
    render(<ScrolledTitle title="Arrival" isShowing={false} />);

    expect(bar()).toHaveAttribute('aria-hidden', 'true');
    expect(bar()).toHaveClass('pointer-events-none');
  });

  it('takes the pointer once it is standing in for the heading', () => {
    render(<ScrolledTitle title="Arrival" isShowing />);

    expect(bar()).toHaveAttribute('aria-hidden', 'false');
    expect(bar()).not.toHaveClass('pointer-events-none');
  });

  it('paints a sliver of itself above its top, so no hairline of content shows through', () => {
    render(<ScrolledTitle title="Arrival" isShowing />);

    expect(bar()).toHaveClass('shadow-[0_-2px_0_var(--color-surface-raised),var(--shadow-raised)]');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(ScrolledTitle.displayName).toBe('ScrolledTitle');
  });
});
