import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Rail } from './Rail';

/**
 * jsdom lays nothing out, so how much a row overflows has to be described: how wide it looks, how
 * wide it really is, and how wide one card in it is.
 *
 * The gap is set as a real style rather than by standing in for `getComputedStyle`. Everything that
 * reads an element's accessible name asks that same function, so a stand-in returning only the one
 * property it was asked for takes every `getByRole` in the file down with it.
 */
const overflowing = (element: HTMLElement, options: { scrollLeft?: number }) => {
  Object.defineProperty(element, 'scrollWidth', { configurable: true, value: 3000 });
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: 1000 });
  Object.defineProperty(element, 'scrollLeft', {
    configurable: true,
    writable: true,
    value: options.scrollLeft ?? 0,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 300 });

  element.style.columnGap = '16px';
};

const items = ['One', 'Two', 'Three'].map((name) => <li key={name}>{name}</li>);

describe('Rail', () => {
  it('names itself so the row can be found', () => {
    render(<Rail title="Recently added">{items}</Rail>);

    expect(screen.getByRole('region', { name: 'Recently added' })).toBeInTheDocument();
  });

  it('shows what it was given', () => {
    render(<Rail title="Recently added">{items}</Rail>);

    expect(screen.getByText('Two')).toBeInTheDocument();
  });

  it('offers nowhere to go before anything overflows', () => {
    render(<Rail title="Recently added">{items}</Rail>);

    expect(screen.queryByRole('button', { name: /Show page/ })).not.toBeInTheDocument();
  });

  it('offers a marker per screenful once there is more to see', () => {
    const { container } = render(<Rail title="Recently added">{items}</Rail>);
    const track = container.querySelector('ul');

    if (track !== null) {
      overflowing(track, {});
      fireEvent.scroll(track);
    }

    expect(screen.getAllByRole('button', { name: /Show page/ })).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Show page 1' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('says which screenful is showing once it has moved', () => {
    const { container } = render(<Rail title="Recently added">{items}</Rail>);
    const track = container.querySelector('ul');

    if (track !== null) {
      overflowing(track, { scrollLeft: 850 });
      fireEvent.scroll(track);
    }

    expect(screen.getByRole('button', { name: 'Show page 2' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('turns by whole cards, so the row never settles on half of one', async () => {
    const user = userEvent.setup();
    const { container } = render(<Rail title="Recently added">{items}</Rail>);
    const track = container.querySelector('ul');
    const scrollTo = vi.fn();

    if (track !== null) {
      overflowing(track, {});
      track.scrollTo = scrollTo;
      fireEvent.scroll(track);
    }

    await user.click(screen.getByRole('button', { name: 'Show page 2' }));

    expect(scrollTo).toHaveBeenCalledWith({ left: 3 * 316, behavior: 'smooth' });
  });

  it('offers no arrow before the row runs off the edge', () => {
    render(<Rail title="Recently added">{items}</Rail>);

    expect(screen.queryByRole('button', { name: /a page of/ })).not.toBeInTheDocument();
  });

  it('offers a way on, but not back, while the row is at its start', () => {
    const { container } = render(<Rail title="Recently added">{items}</Rail>);
    const track = container.querySelector('ul');

    if (track !== null) {
      overflowing(track, {});
      fireEvent.scroll(track);
    }

    expect(
      screen.getByRole('button', { name: 'Forward a page of Recently added' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Back a page of Recently added' }),
    ).not.toBeInTheDocument();
  });

  it('offers a way back once the row has been moved on', () => {
    const { container } = render(<Rail title="Recently added">{items}</Rail>);
    const track = container.querySelector('ul');

    if (track !== null) {
      overflowing(track, { scrollLeft: 3 * 316 });
      fireEvent.scroll(track);
    }

    expect(
      screen.getByRole('button', { name: 'Back a page of Recently added' }),
    ).toBeInTheDocument();
  });

  it('turns the page by whole cards, as the markers above it do', async () => {
    const user = userEvent.setup();
    const { container } = render(<Rail title="Recently added">{items}</Rail>);
    const track = container.querySelector('ul');
    const scrollTo = vi.fn();

    if (track !== null) {
      overflowing(track, {});
      track.scrollTo = scrollTo;
      fireEvent.scroll(track);
    }

    await user.click(screen.getByRole('button', { name: 'Forward a page of Recently added' }));

    expect(scrollTo).toHaveBeenCalledWith({ left: 3 * 316, behavior: 'smooth' });
  });

  it('stands on the card hanging over the edge, and is exactly as wide as the part that shows', () => {
    const { container } = render(<Rail title="Recently added">{items}</Rail>);
    const track = container.querySelector('ul');

    if (track !== null) {
      overflowing(track, {});
      fireEvent.scroll(track);
    }

    expect(screen.getByRole('button', { name: 'Forward a page of Recently added' })).toHaveStyle({
      width: '52px',
    });
  });

  it('asks for a denser row where the cards stand taller than they are wide', () => {
    const { container } = render(
      <Rail title="Cast" sizesCards cards="portrait">
        {items}
      </Rail>,
    );

    expect(container.querySelector('section')).toHaveClass('[--rail-per:3]');
  });

  it('sizes cards for a film row unless told they stand tall', () => {
    const { container } = render(
      <Rail title="Recently added" sizesCards>
        {items}
      </Rail>,
    );

    expect(container.querySelector('section')).toHaveClass('[--rail-per:2]');
  });

  it('stands the way back on what hangs over behind, which is a different measure', () => {
    const { container } = render(<Rail title="Recently added">{items}</Rail>);
    const track = container.querySelector('ul');

    if (track !== null) {
      overflowing(track, { scrollLeft: 3 * 316 });
      fireEvent.scroll(track);
    }

    expect(screen.getByRole('button', { name: 'Back a page of Recently added' })).toHaveStyle({
      width: '44px',
    });
  });

  it('takes the hover off the card beneath it, so the two do not answer at once', () => {
    const { container } = render(<Rail title="Recently added">{items}</Rail>);
    const track = container.querySelector('ul');

    if (track !== null) {
      overflowing(track, {});
      fireEvent.scroll(track);
    }

    const onward = screen.getByRole('button', { name: 'Forward a page of Recently added' });

    expect(onward).toHaveClass('hover-hover:pointer-events-auto');
    expect(onward).toHaveClass('pointer-events-none');
  });

  it('shows an action beside the heading when one is given', () => {
    render(
      <Rail title="Recently added" action={<span>See all</span>}>
        {items}
      </Rail>,
    );

    expect(screen.getByText('See all')).toBeInTheDocument();
  });

  it('leaves the heading as plain text when it leads nowhere', () => {
    render(<Rail title="Continue watching">{items}</Rail>);

    expect(screen.queryByRole('button', { name: 'Continue watching' })).not.toBeInTheDocument();
  });

  it('makes the heading a control when it names something to open', async () => {
    const onOpenTitle = vi.fn();
    const user = userEvent.setup();
    render(
      <Rail title="A Sign of Affection · Season 1" onOpenTitle={onOpenTitle}>
        {items}
      </Rail>,
    );

    await user.click(screen.getByRole('button', { name: 'A Sign of Affection · Season 1' }));

    expect(onOpenTitle).toHaveBeenCalledOnce();
  });

  it('keeps the heading a heading, so the row is still found by its name', () => {
    render(
      <Rail title="A Sign of Affection · Season 1" onOpenTitle={vi.fn()}>
        {items}
      </Rail>,
    );

    expect(
      screen.getByRole('heading', { name: 'A Sign of Affection · Season 1' }),
    ).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(Rail.displayName).toBe('Rail');
  });
});
