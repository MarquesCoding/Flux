import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NavDock } from './NavDock';
import { ActionMenu } from '@ValenceUI/ActionMenu';
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

    expect(container.querySelectorAll('.valence-glass')).toHaveLength(1);
  });

  it('says which place is being stood on', () => {
    render(<NavDock {...props} />);

    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Films' })).not.toHaveAttribute('aria-current');
  });

  it('shows where you are in a way the pointer cannot take away', async () => {
    const actor = userEvent.setup();

    render(<NavDock {...props} />);

    const here = screen.getByRole('button', { name: 'Home' });
    const elsewhere = screen.getByRole('button', { name: 'Films' });

    expect(here).toHaveClass('text-primary');

    await actor.hover(elsewhere);

    expect(here).toHaveClass('text-primary');
    expect(elsewhere).not.toHaveClass('text-primary');
  });

  it('stands a mark under the place being stood on, and nowhere else', () => {
    const { container } = render(<NavDock {...props} />);

    const dots = container.querySelectorAll('.bg-primary');

    expect(dots).toHaveLength(1);
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

  it('reads as icons, with the names kept out of the row', () => {
    render(<NavDock {...props} />);

    expect(screen.getByRole('button', { name: 'Home' })).not.toHaveTextContent('Home');
    expect(screen.getByRole('button', { name: 'Films' })).not.toHaveTextContent('Films');
  });

  it('names every place for anybody who cannot see the icons', () => {
    render(<NavDock {...props} />);

    for (const label of ['Home', 'Films']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('names the icon a pointer rests on, out of the row rather than in it', async () => {
    const user = userEvent.setup();

    render(<NavDock {...props} />);

    await user.hover(screen.getByRole('button', { name: 'Films' }));

    expect(await screen.findByText('Films', {}, { timeout: 3000 })).toBeInTheDocument();
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

describe('what a dock can carry besides places', () => {
  it('shows a mark for the instance when it is given one', () => {
    render(<NavDock {...props} brand={<span>Valence</span>} />);

    expect(screen.getByText('Valence')).toBeInTheDocument();
  });

  it('carries no mark at all when it is not given one', () => {
    render(<NavDock {...props} />);

    expect(screen.queryByText('Valence')).not.toBeInTheDocument();
  });

  it('draws the icon a place carries', () => {
    render(
      <NavDock
        {...props}
        items={[{ id: 'home', label: 'Home', icon: <span data-testid="home-icon" /> }]}
      />,
    );

    expect(screen.getByTestId('home-icon')).toBeInTheDocument();
  });

  it('fills the icon in for the place being stood on', () => {
    render(
      <NavDock
        {...props}
        items={[
          {
            id: 'home',
            label: 'Home',
            icon: <span data-testid="outline" />,
            activeIcon: <span data-testid="filled" />,
          },
        ]}
      />,
    );

    expect(screen.getByTestId('filled')).toBeInTheDocument();
    expect(screen.queryByTestId('outline')).not.toBeInTheDocument();
  });

  it('falls back to the ordinary icon when a place has no filled one', () => {
    render(
      <NavDock
        {...props}
        items={[{ id: 'home', label: 'Home', icon: <span data-testid="outline" /> }]}
      />,
    );

    expect(screen.getByTestId('outline')).toBeInTheDocument();
  });

  it('holds both drawings for a place whose mark fills as it is pointed at', () => {
    render(
      <NavDock
        {...props}
        items={[
          {
            id: 'favourites',
            label: 'Favourites',
            icon: <span data-testid="outline" />,
            activeIcon: <span data-testid="filled" />,
            gesture: 'fill',
          },
        ]}
      />,
    );

    expect(screen.getByTestId('outline')).toBeInTheDocument();
    expect(screen.getByTestId('filled')).toBeInTheDocument();
  });

  it('uncovers the filled drawing while a place is pointed at', async () => {
    const user = userEvent.setup();

    render(
      <NavDock
        {...props}
        items={[
          {
            id: 'favourites',
            label: 'Favourites',
            icon: <span data-testid="outline" />,
            activeIcon: <span data-testid="filled" />,
            gesture: 'fill',
          },
        ]}
      />,
    );

    const covering = screen.getByTestId('filled').parentElement;

    expect(covering).toHaveStyle({ clipPath: 'inset(100% 0% 0% 0%)' });

    await user.hover(screen.getByRole('button', { name: 'Favourites' }));

    expect(covering).toHaveStyle({ clipPath: 'inset(0% 0% 0% 0%)' });
  });

  it('shows a count on a tool that has something to say', () => {
    render(
      <NavDock
        {...props}
        actions={[
          {
            id: 'search',
            label: 'Search',
            icon: <span />,
            badge: <span data-testid="count">3</span>,
            onSelect: vi.fn(),
          },
        ]}
      />,
    );

    expect(screen.getByTestId('count')).toBeInTheDocument();
  });
  it('holds an action still while its own panel is open', async () => {
    const user = userEvent.setup();

    render(
      <NavDock
        {...props}
        actions={[
          {
            id: 'notifications',
            label: 'Notifications',
            icon: <span data-testid="outline" aria-expanded="true" />,
            activeIcon: <span data-testid="filled" />,
            gesture: 'fill',
            onSelect: vi.fn(),
          },
        ]}
      />,
    );

    const covering = screen.getByTestId('filled').parentElement;

    await user.hover(screen.getByRole('button', { name: 'Notifications' }));

    await waitFor(() => {
      expect(covering).toHaveStyle({ clipPath: 'inset(100% 0% 0% 0%)' });
    });
  });

  it('still answers a pointer on an action whose panel is shut', async () => {
    const user = userEvent.setup();

    render(
      <NavDock
        {...props}
        actions={[
          {
            id: 'notifications',
            label: 'Notifications',
            icon: <span data-testid="outline" />,
            activeIcon: <span data-testid="filled" />,
            gesture: 'fill',
            onSelect: vi.fn(),
          },
        ]}
      />,
    );

    const covering = screen.getByTestId('filled').parentElement;

    expect(covering).toHaveStyle({ clipPath: 'inset(100% 0% 0% 0%)' });

    await user.hover(screen.getByRole('button', { name: 'Notifications' }));

    await waitFor(() => {
      expect(covering).not.toHaveStyle({ clipPath: 'inset(100% 0% 0% 0%)' });
    });
  });
  it('holds a real menu\u2019s icon still once the menu is open', async () => {
    const user = userEvent.setup();

    render(
      <NavDock
        {...props}
        actions={[
          {
            id: 'surprise',
            label: 'Surprise',
            icon: <span />,
            gesture: 'fill',
            activeIcon: <span data-testid="filled" />,
            control: (
              <ActionMenu
                label="Choose"
                trigger={<span data-testid="dice" />}
                groups={[{ items: [{ id: 'anything', label: 'Anything', onChoose: vi.fn() }] }]}
              />
            ),
          },
        ]}
      />,
    );

    await user.hover(screen.getByRole('button', { name: 'Choose' }));
    await user.click(screen.getByRole('button', { name: 'Choose' }));

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Anything' })).toBeInTheDocument();
    });

    const wrapper = screen.getByTestId('dice').closest('[data-highlight]');

    expect(wrapper?.querySelector('[aria-expanded="true"]')).not.toBeNull();

    await waitFor(() => {
      expect(screen.getByTestId('dice').parentElement?.parentElement).toHaveStyle({
        transform: 'scale(1)',
      });
    });
  });
});
