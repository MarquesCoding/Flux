import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CastGrid } from './CastGrid';

const members = Array.from({ length: 14 }, (_, at) => ({
  name: `Player ${(at + 1).toString()}`,
  role: `Part ${(at + 1).toString()}`,
  imageUrl: null,
}));

/**
 * jsdom lays nothing out and scrolls nothing, so the row has to be told how wide it is and how much
 * of it runs off the edge.
 */
const rowOf = (visible: number, whole: number) => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    value: visible,
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    value: whole,
  });
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CastGrid', () => {
  it('draws everybody, since the row scrolls rather than swapping who is on it', () => {
    rowOf(1100, 2400);
    render(<CastGrid members={members} />);

    expect(screen.getAllByText(/^Player /)).toHaveLength(14);
  });

  it('keeps the last face in the document, where a swapped page would drop it', () => {
    rowOf(1100, 2400);
    render(<CastGrid members={members} />);

    expect(screen.getByText('Player 14')).toBeInTheDocument();
  });

  it('scrolls rather than jumping, so a page turn is the row moving', () => {
    rowOf(1100, 2400);
    render(<CastGrid members={members} />);

    const track = screen.getByText('Player 1').closest('ul');

    expect(track).toHaveClass('overflow-x-auto');
    expect(track).toHaveClass('scroll-smooth');
  });

  it('takes a marker as a request to scroll there', async () => {
    const scrollTo = vi.fn();

    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    });
    rowOf(1100, 2400);

    const user = userEvent.setup();
    render(<CastGrid members={members} />);

    await user.click(screen.getByRole('button', { name: 'Show page 2' }));

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
  });

  it('says how many there are in total, once there are more than one page of them', () => {
    rowOf(1100, 2400);
    render(<CastGrid members={members} />);

    expect(screen.getByText('14')).toBeInTheDocument();
  });

  it('offers nowhere to turn when everybody already fits', () => {
    rowOf(1100, 1100);
    render(<CastGrid members={members.slice(0, 4)} />);

    expect(screen.queryByRole('button', { name: /Show page/ })).not.toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(CastGrid.displayName).toBe('CastGrid');
  });
  it('opens a performer the catalogue gave an identifier', async () => {
    const onOpenPerson = vi.fn();

    render(
      <CastGrid
        members={[{ personId: 1245, name: 'Amy Adams', role: 'Louise', imageUrl: null }]}
        onOpenPerson={onOpenPerson}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'About Amy Adams' }));

    expect(onOpenPerson).toHaveBeenCalledWith(
      expect.objectContaining({ personId: 1245, name: 'Amy Adams' }),
    );
  });

  it('will not open a name the catalogue never matched', async () => {
    const onOpenPerson = vi.fn();

    render(
      <CastGrid
        members={[{ personId: null, name: 'Amy Adams', role: 'Louise', imageUrl: null }]}
        onOpenPerson={onOpenPerson}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'About Amy Adams' }));

    expect(onOpenPerson).not.toHaveBeenCalled();
  });

  it('still names everybody when there is nowhere to open them', () => {
    render(<CastGrid members={[{ name: 'Amy Adams', role: 'Louise', imageUrl: null }]} />);

    expect(screen.getByText('Amy Adams')).toBeInTheDocument();
    expect(screen.getByText('Louise')).toBeInTheDocument();
  });
});
