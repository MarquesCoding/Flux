import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NavDock } from './NavDock';
import type * as MotionReact from 'motion/react';

const motion = vi.hoisted(() => ({ isReduced: false }));

vi.mock('motion/react', async () => ({
  ...(await vi.importActual<typeof MotionReact>('motion/react')),
  useReducedMotion: () => motion.isReduced,
}));

const ITEMS = [
  { id: 'home', label: 'Home' },
  { id: 'films', label: 'Films' },
];

const props = { items: ITEMS, selectedId: 'home', onSelect: vi.fn() };

afterEach(() => {
  motion.isReduced = false;
});

describe('NavDock', () => {
  it('names itself, so a screen reader can skip to it', () => {
    render(<NavDock {...props} />);

    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
  });

  it('is one bar rather than two, so places and tools read as one navigation', () => {
    const { container } = render(
      <NavDock
        {...props}
        actions={[{ id: 'search', label: 'Search', icon: null, onSelect: vi.fn() }]}
      />,
    );

    expect(container.querySelectorAll('.flux-glass')).toHaveLength(1);
  });

  it('says which place is being stood on', () => {
    render(<NavDock {...props} />);

    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Films' })).not.toHaveAttribute('aria-current');
  });

  it('goes where it is asked', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(<NavDock {...props} onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: 'Films' }));

    expect(onSelect).toHaveBeenCalledWith('films');
  });

  it('marks every item as something the highlight can travel to', () => {
    render(<NavDock {...props} />);

    expect(screen.getByRole('button', { name: 'Films' })).toHaveAttribute(
      'data-highlight',
      'films',
    );
  });

  it('names only the place being stood on, so the rest read as icons', () => {
    render(<NavDock {...props} />);

    expect(screen.getByRole('button', { name: 'Home' })).toHaveTextContent('Home');
    expect(screen.getByRole('button', { name: 'Films' })).not.toHaveTextContent('Films');
  });

  it('does a tool where it stands rather than going somewhere', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <NavDock {...props} actions={[{ id: 'search', label: 'Search', icon: null, onSelect }]} />,
    );

    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSelect).toHaveBeenCalled();
  });

  it('draws a tool that opens something as itself, not wrapped in a button', () => {
    render(
      <NavDock
        {...props}
        actions={[
          {
            id: 'bell',
            label: 'Notifications',
            icon: null,
            control: <button type="button">Bell</button>,
            onSelect: vi.fn(),
          },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Bell' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument();
  });

  it('says a tool is the current place, since search is both', () => {
    render(
      <NavDock
        {...props}
        actions={[
          { id: 'search', label: 'Search', icon: null, isCurrent: true, onSelect: vi.fn() },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Search' })).toHaveAttribute('aria-current', 'page');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(NavDock.displayName).toBe('NavDock');
  });

  it('moves the mark without animating it when less motion was asked for', () => {
    motion.isReduced = true;

    render(<NavDock items={ITEMS} selectedId="home" onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
  });
});
