import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NavBar } from './NavBar';
import { ActionMenu } from '@ValenceUI/ActionMenu';
import type * as MotionReact from 'motion/react';

const motion = vi.hoisted(() => ({ isReduced: false }));

vi.mock('motion/react', async () => ({
  ...(await vi.importActual<typeof MotionReact>('motion/react')),
  useReducedMotion: () => motion.isReduced,
  useReducedMotionConfig: () => motion.isReduced,
}));

const ITEMS = [
  { id: 'home', label: 'Home' },
  { id: 'films', label: 'Films' },
];

const props = { items: ITEMS, selectedId: 'home', onSelect: vi.fn() };

afterEach(() => {
  motion.isReduced = false;
});

describe('NavBar', () => {
  it('names itself, so a screen reader can skip to it', () => {
    render(<NavBar {...props} />);

    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
  });

  it('is one bar rather than two, so places and tools read as one navigation', () => {
    render(
      <NavBar
        {...props}
        actions={[{ id: 'search', label: 'Search', icon: null, onSelect: vi.fn() }]}
      />,
    );

    const bar = screen.getByRole('navigation', { name: 'Sections' });

    expect(within(bar).getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it('runs along the top of the window rather than floating at its foot', () => {
    const { container } = render(<NavBar {...props} />);

    expect(container.querySelector('header')).toHaveClass('fixed', 'top-0', 'inset-x-0');
  });

  it('is solid where the page does not say how far it has been scrolled', () => {
    const { container } = render(<NavBar {...props} />);

    expect(container.querySelector('[data-slot="nav-bar-fill"]')).toHaveStyle({ opacity: '1' });
  });

  it('is clear at the top of a page, and painted in as far as the page says', () => {
    const { container: top } = render(<NavBar {...props} solidity={0} />);
    const { container: halfway } = render(<NavBar {...props} solidity={0.5} />);

    expect(top.querySelector('[data-slot="nav-bar-fill"]')).toHaveStyle({ opacity: '0' });
    expect(halfway.querySelector('[data-slot="nav-bar-fill"]')).toHaveStyle({ opacity: '0.5' });
  });

  it('says which place is being stood on', () => {
    render(<NavBar {...props} />);

    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Films' })).not.toHaveAttribute('aria-current');
  });

  it('shows where you are in a way the pointer cannot take away', async () => {
    const actor = userEvent.setup();

    render(<NavBar {...props} />);

    const here = screen.getByRole('button', { name: 'Home' });
    const elsewhere = screen.getByRole('button', { name: 'Films' });

    expect(here).toHaveAttribute('aria-current', 'page');

    await actor.hover(elsewhere);

    expect(here).toHaveAttribute('aria-current', 'page');
    expect(here).toHaveClass('text-text');
    expect(here).not.toHaveClass('text-text-muted');
    expect(elsewhere).not.toHaveAttribute('aria-current');
  });

  it('stands a mark behind the place being stood on, and nowhere else', () => {
    const { container } = render(<NavBar {...props} />);

    const marks = container.querySelectorAll('[data-mark="nav-bar-mark"]');

    expect(marks).toHaveLength(1);
    expect(marks[0]?.closest('button')).toBe(screen.getByRole('button', { name: 'Home' }));
  });

  it('carries the mark to whatever the pointer rests on, and back when it leaves', async () => {
    const actor = userEvent.setup();
    const { container } = render(<NavBar {...props} />);

    await actor.hover(screen.getByRole('button', { name: 'Films' }));

    expect(container.querySelector('[data-mark="nav-bar-mark"]')?.closest('button')).toBe(
      screen.getByRole('button', { name: 'Films' }),
    );

    await actor.unhover(screen.getByRole('navigation', { name: 'Sections' }));

    expect(container.querySelector('[data-mark="nav-bar-mark"]')?.closest('button')).toBe(
      screen.getByRole('button', { name: 'Home' }),
    );
  });

  it('draws the mark in the same corner as the places it moves between', () => {
    const { container } = render(<NavBar {...props} />);

    expect(container.querySelector('[data-mark="nav-bar-mark"]')).toHaveClass('rounded-md');
  });

  it('goes where it is asked', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(<NavBar {...props} onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: 'Films' }));

    expect(onSelect).toHaveBeenCalledWith('films');
  });

  it('marks every tool as something whose open panel can hold it still', () => {
    render(
      <NavBar
        {...props}
        actions={[{ id: 'search', label: 'Search', icon: null, onSelect: vi.fn() }]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Search' })).toHaveAttribute(
      'data-highlight',
      'search',
    );
  });

  it('writes the places as words where there is room for them', () => {
    render(<NavBar {...props} />);

    expect(screen.getByRole('button', { name: 'Home' })).toHaveTextContent('Home');
    expect(screen.getByText('Films')).toHaveClass('hidden', 'md:inline');
  });

  it('draws each tool as a round button of one size, so a face sits in it as well as a glyph', () => {
    render(
      <NavBar
        {...props}
        actions={[{ id: 'search', label: 'Search', icon: null, onSelect: vi.fn() }]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Search' })).toHaveClass('size-9', 'rounded-md');
  });

  it('names every place for anybody who cannot see the icons', () => {
    render(<NavBar {...props} />);

    for (const label of ['Home', 'Films']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('names a tool a pointer rests on, since a tool is only ever an icon', async () => {
    const user = userEvent.setup();

    render(
      <NavBar
        {...props}
        actions={[{ id: 'search', label: 'Search', icon: <span />, onSelect: vi.fn() }]}
      />,
    );

    await user.hover(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Search', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('does a tool where it stands rather than going somewhere', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <NavBar {...props} actions={[{ id: 'search', label: 'Search', icon: null, onSelect }]} />,
    );

    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSelect).toHaveBeenCalled();
  });

  it('draws a tool that opens something as itself, not wrapped in a button', () => {
    render(
      <NavBar
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
      <NavBar
        {...props}
        actions={[
          { id: 'search', label: 'Search', icon: null, isCurrent: true, onSelect: vi.fn() },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Search' })).toHaveAttribute('aria-current', 'page');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(NavBar.displayName).toBe('NavBar');
  });

  it('moves the mark without animating it when less motion was asked for', () => {
    motion.isReduced = true;

    render(<NavBar items={ITEMS} selectedId="home" onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
  });
});

describe('what the bar can carry besides places', () => {
  it('shows a mark for the instance when it is given one', () => {
    render(<NavBar {...props} brand={<span>Valence</span>} />);

    expect(screen.getByText('Valence')).toBeInTheDocument();
  });

  it('carries no mark at all when it is not given one', () => {
    render(<NavBar {...props} />);

    expect(screen.queryByText('Valence')).not.toBeInTheDocument();
  });

  it('draws the icon a place carries', () => {
    render(
      <NavBar
        {...props}
        items={[{ id: 'home', label: 'Home', icon: <span data-testid="home-icon" /> }]}
      />,
    );

    expect(screen.getByTestId('home-icon')).toBeInTheDocument();
  });

  it('fills the icon in for the place being stood on', () => {
    render(
      <NavBar
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
      <NavBar
        {...props}
        items={[{ id: 'home', label: 'Home', icon: <span data-testid="outline" /> }]}
      />,
    );

    expect(screen.getByTestId('outline')).toBeInTheDocument();
  });

  it('holds both drawings for a place whose mark fills as it is pointed at', () => {
    render(
      <NavBar
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
      <NavBar
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

    await waitFor(() => {
      expect(covering).toHaveStyle({ clipPath: 'inset(0% 0% 0% 0%)' });
    });
  });

  it('shows a count on a tool that has something to say', () => {
    render(
      <NavBar
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
      <NavBar
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
      <NavBar
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
      <NavBar
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

describe('the place being stood on', () => {
  const WITH_ICONS = [
    {
      id: 'home',
      label: 'Home',
      icon: <span data-testid="home-icon" />,
      activeIcon: <span data-testid="home-icon-on" />,
      gesture: 'fill' as const,
    },
    {
      id: 'films',
      label: 'Films',
      icon: <span data-testid="films-icon" />,
      activeIcon: <span data-testid="films-icon-on" />,
      gesture: 'fill' as const,
    },
  ];

  it('carries its icon beside its word, where every other place keeps to its word', () => {
    render(<NavBar items={WITH_ICONS} selectedId="home" onSelect={vi.fn()} />);

    expect(screen.getByTestId('home-icon-on').closest('span.z-10')).not.toHaveClass('md:w-0');
    expect(screen.getByTestId('films-icon').closest('span.z-10')).toHaveClass('md:w-0');
  });

  it('closes an icon away rather than dropping it, so a place changing does not jump', () => {
    render(<NavBar items={WITH_ICONS} selectedId="home" onSelect={vi.fn()} />);

    const folded = screen.getByTestId('films-icon').closest('span.z-10');

    expect(folded).toHaveClass('md:opacity-0', 'overflow-hidden');
    expect(folded).not.toHaveClass('md:hidden');
  });

  it('holds its icon still, with nothing wiped over it when a pointer rests there', async () => {
    const actor = userEvent.setup();

    render(<NavBar items={WITH_ICONS} selectedId="home" onSelect={vi.fn()} />);

    const here = screen.getByRole('button', { name: 'Home' });
    const elsewhere = screen.getByRole('button', { name: 'Films' });

    await actor.hover(here);

    expect(within(here).queryByTestId('home-icon')).not.toBeInTheDocument();
    expect(within(here).getAllByTestId(/home-icon/)).toHaveLength(1);
    expect(within(elsewhere).getAllByTestId(/films-icon/)).toHaveLength(2);
  });

  it('keeps the mark on a place just pressed until the page says it is the one stood on', async () => {
    const actor = userEvent.setup();
    const { container, rerender } = render(<NavBar {...props} />);

    const films = screen.getByRole('button', { name: 'Films' });

    await actor.click(films);

    expect(container.querySelector('[data-mark="nav-bar-mark"]')?.closest('button')).toBe(films);

    rerender(<NavBar {...props} selectedId="films" />);

    expect(container.querySelector('[data-mark="nav-bar-mark"]')?.closest('button')).toBe(films);
    expect(films).toHaveAttribute('aria-current', 'page');
  });

  it('holds the mark where it was put when focus moves from one place to the next', async () => {
    const actor = userEvent.setup();
    const { container } = render(<NavBar {...props} />);

    const films = screen.getByRole('button', { name: 'Films' });

    await actor.click(screen.getByRole('button', { name: 'Home' }));
    await actor.click(films);

    expect(container.querySelector('[data-mark="nav-bar-mark"]')?.closest('button')).toBe(films);
  });
});
