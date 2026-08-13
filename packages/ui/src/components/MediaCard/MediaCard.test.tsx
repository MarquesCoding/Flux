import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaCard } from './MediaCard';
import type * as MotionReact from 'motion/react';

const motion = vi.hoisted(() => ({ isReduced: false }));

vi.mock('motion/react', async () => ({
  ...(await vi.importActual<typeof MotionReact>('motion/react')),
  useReducedMotion: () => motion.isReduced,
}));

afterEach(() => {
  motion.isReduced = false;
});

describe('MediaCard', () => {
  it('is a single button covering the whole tile', async () => {
    const onSelect = vi.fn();
    const actor = userEvent.setup();
    render(<MediaCard title="Arrival" subtitle="2016" onSelect={onSelect} />);

    await actor.click(screen.getByRole('button', { name: /Arrival/ }));

    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('can be activated from the keyboard', async () => {
    const onSelect = vi.fn();
    const actor = userEvent.setup();
    render(<MediaCard title="Arrival" subtitle="2016" onSelect={onSelect} />);

    await actor.tab();
    await actor.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('shows the title and subtitle', () => {
    render(<MediaCard title="Arrival" subtitle="2016 · 1:56" onSelect={vi.fn()} />);

    expect(screen.getByText('Arrival')).toBeInTheDocument();
    expect(screen.getByText('2016 · 1:56')).toBeInTheDocument();
  });

  it('shows badges when given them', () => {
    render(
      <MediaCard title="Arrival" subtitle="2016" badges={['4K', 'HDR10']} onSelect={vi.fn()} />,
    );

    expect(screen.getByText('4K')).toBeInTheDocument();
    expect(screen.getByText('HDR10')).toBeInTheDocument();
  });

  it('falls back to the first letter when there is no artwork', () => {
    render(<MediaCard title="arrival" subtitle="2016" onSelect={vi.fn()} />);

    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('shows artwork when it exists', () => {
    render(<MediaCard title="Arrival" subtitle="2016" imageUrl="/poster.jpg" onSelect={vi.fn()} />);

    expect(screen.getByRole('presentation', { hidden: true })).toHaveAttribute(
      'src',
      '/poster.jpg',
    );
  });

  it('does not announce the poster twice', () => {
    render(<MediaCard title="Arrival" subtitle="2016" imageUrl="/poster.jpg" onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Arrival 2016' })).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(MediaCard.displayName).toBe('MediaCard');
  });

  it('sets a lead card apart by wearing its title over the artwork', () => {
    render(
      <MediaCard title="Arrival" subtitle="2016" emphasis="lead" shape="wide" onSelect={vi.fn()} />,
    );

    const card = screen.getByRole('button', { name: /Arrival/ });
    const title = screen.getByText('Arrival');

    expect(card.querySelector('img, span[aria-hidden]')).not.toBeNull();
    expect(title.className).toContain('text-white');
  });

  it('shows badges over the artwork, where they stay readable', () => {
    render(
      <MediaCard title="Arrival" subtitle="2016" badges={['4K', 'HDR10']} onSelect={vi.fn()} />,
    );

    expect(screen.getByText('4K')).toHaveClass('bg-black/60');
  });

  it('draws the card without its motion for somebody who asked for less', () => {
    motion.isReduced = true;

    render(<MediaCard title="Arrival" subtitle="2016" onSelect={vi.fn()} />);

    expect(screen.getByText('Arrival')).toBeInTheDocument();
  });
});
