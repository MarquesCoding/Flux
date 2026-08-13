import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PageDots } from './PageDots';

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
});
