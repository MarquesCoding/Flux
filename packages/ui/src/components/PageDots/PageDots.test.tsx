import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { motionValue } from 'motion/react';
import { describe, expect, it, vi } from 'vitest';
import { PageDots } from './PageDots';

/**
 * The fill counting down the page that is showing, where there is one.
 *
 * @param container - What was rendered.
 * @returns Every fill drawn.
 */
const fillsOf = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll('[data-slot="page-dots-fill"]')).filter(
    (found): found is HTMLElement => found instanceof HTMLElement,
  );

describe('PageDots', () => {
  it('draws one marker per thing there is', () => {
    render(<PageDots count={4} selectedIndex={0} onSelect={vi.fn()} />);

    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('says nothing where there is nowhere to go', () => {
    const { container } = render(<PageDots count={1} selectedIndex={0} onSelect={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('says which one is showing', () => {
    render(<PageDots count={3} selectedIndex={1} onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Show page 2' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('goes where it is pressed', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(<PageDots count={3} selectedIndex={0} onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: 'Show page 3' }));

    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('names each marker after the thing it points at, where they have names', () => {
    render(
      <PageDots count={2} selectedIndex={0} labels={['Arrival', 'Dune']} onSelect={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Show Dune' })).toBeInTheDocument();
  });

  it('shows that name out of the page, so a corner cannot clip it', async () => {
    const user = userEvent.setup();

    render(
      <PageDots count={2} selectedIndex={0} labels={['Arrival', 'Dune']} onSelect={vi.fn()} />,
    );

    expect(screen.queryByText('Dune')).not.toBeInTheDocument();

    await user.hover(screen.getByRole('button', { name: 'Show Dune' }));

    expect(await screen.findByText('Dune', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('names the row itself, since a page may carry more than one', () => {
    render(<PageDots count={2} selectedIndex={0} label="Featured items" onSelect={vi.fn()} />);

    expect(screen.getByRole('list', { name: 'Featured items' })).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(PageDots.displayName).toBe('PageDots');
  });

  it('fills the marker as far through its turn as whatever advances the pages says', () => {
    const progress = motionValue(0.4);
    const { container } = render(
      <PageDots count={3} selectedIndex={1} onSelect={vi.fn()} progress={progress} />,
    );

    const [fill] = fillsOf(container);

    expect(fill?.style.transform).toContain('scaleX(0.4)');
  });

  it('follows that count as it moves, rather than keeping a clock of its own', async () => {
    const progress = motionValue(0.1);
    const { container } = render(
      <PageDots count={3} selectedIndex={1} onSelect={vi.fn()} progress={progress} />,
    );

    act(() => {
      progress.set(0.8);
    });

    await waitFor(() => {
      expect(fillsOf(container)[0]?.style.transform).toContain('scaleX(0.8)');
    });
  });

  it('fills only the one being counted down, not the rest', () => {
    const { container } = render(
      <PageDots count={4} selectedIndex={2} onSelect={vi.fn()} progress={motionValue(0.5)} />,
    );

    expect(fillsOf(container)).toHaveLength(1);
    expect(fillsOf(container)[0]?.closest('button')).toHaveAttribute('aria-current', 'true');
  });

  it('fills nothing where the markers describe something that only moves when asked', () => {
    const { container } = render(<PageDots count={3} selectedIndex={0} onSelect={vi.fn()} />);

    expect(fillsOf(container)).toHaveLength(0);
  });

  it('draws in the page colours by default', () => {
    render(<PageDots count={2} selectedIndex={0} onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Show page 1' }).firstElementChild).toHaveClass(
      'bg-text',
    );
  });

  it('draws light over a picture whatever the theme, where it sits over one', () => {
    render(<PageDots count={2} selectedIndex={0} tone="overlay" onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Show page 1' }).firstElementChild).toHaveClass(
      'bg-on-scrim',
    );
    expect(screen.getByRole('button', { name: 'Show page 2' }).firstElementChild).toHaveClass(
      'bg-on-scrim/45',
    );
  });
});
