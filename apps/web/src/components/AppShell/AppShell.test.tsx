import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';
import type { AppShellProps } from './AppShell.types';

const draw = (overrides: Partial<AppShellProps> = {}) => {
  const props: AppShellProps = {
    section: 'home',
    onSectionChange: vi.fn(),
    children: <p>The library</p>,
    ...overrides,
  };

  const view = render(<AppShell {...props} />);

  return { props, view };
};

describe('AppShell', () => {
  it('draws what it was given', () => {
    draw();

    expect(screen.getByText('The library')).toBeInTheDocument();
  });

  it('offers the few places worth going', () => {
    draw();

    for (const section of ['Home', 'Search', 'Account']) {
      expect(screen.getByRole('button', { name: section })).toBeInTheDocument();
    }
  });

  it('hides administration from everyone who does not administer', () => {
    draw();

    expect(screen.queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('offers administration to someone who does', () => {
    draw({ isAdministrator: true });

    expect(screen.getByRole('button', { name: 'Admin' })).toBeInTheDocument();
  });

  it('says which section the viewer is in', () => {
    draw({ section: 'search' });

    expect(screen.getByRole('button', { name: 'Search' })).toHaveAttribute('aria-current', 'page');
  });

  it('moves between sections on request', async () => {
    const user = userEvent.setup();
    const { props } = draw();

    await user.click(screen.getByRole('button', { name: 'Account' }));

    expect(props.onSectionChange).toHaveBeenCalledWith('account');
  });

  it('lights the page with the colour of what is being shown', () => {
    const { view } = draw({ moodLights: [{ color: '#5a3c8c', at: '20% 30%' }] });

    const bloom = view.container.querySelector<HTMLElement>('.flux-bloom');

    expect(bloom?.style.background).toContain('#5a3c8c');
    expect(bloom?.style.background).toContain('20% 30%');
  });

  it('ends the page with a footer, which carries the room the dock needs', () => {
    draw({ genres: ['Horror'], onGenre: vi.fn() });

    expect(screen.getByRole('navigation', { name: 'Genres' })).toBeInTheDocument();
  });

  it('leaves room beneath the admin page, which has no footer to carry it', () => {
    const { view } = draw({ section: 'admin', genres: ['Horror'], onGenre: vi.fn() });

    expect(view.container.querySelector('main')).toHaveClass('pb-28');
    expect(screen.queryByRole('navigation', { name: 'Genres' })).not.toBeInTheDocument();
  });

  it('opens a genre chosen from the footer', async () => {
    const onGenre = vi.fn<(genre: string) => void>();
    const user = userEvent.setup();

    draw({ genres: ['Horror'], onGenre });

    await user.click(screen.getByRole('button', { name: 'Horror' }));

    expect(onGenre).toHaveBeenCalledWith('Horror');
  });

  it('has no rail down the side to collapse', () => {
    draw();

    expect(screen.queryByRole('button', { name: /sidebar/i })).not.toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(AppShell.displayName).toBe('AppShell');
  });
});
