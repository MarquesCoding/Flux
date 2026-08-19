import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];

/**
 * Enters the Konami code, at the page or at whatever else is given.
 *
 * @param target - What to press the keys at.
 */
const enterTheCode = (target: EventTarget = window) => {
  for (const key of KONAMI) {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }
};

const filmOf = (container: HTMLElement): HTMLElement | null =>
  container.querySelector('[role="presentation"].fixed');

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it('leaves room beneath every page for the dock to float over', () => {
    const { view } = draw();

    expect(view.container.querySelector('main')).toHaveClass('pb-28');
  });

  it('ends the page with the content rather than with a second navigation', () => {
    const { view } = draw();

    expect(view.container.querySelector('footer')).toBeNull();
  });

  it('has no rail down the side to collapse', () => {
    draw();

    expect(screen.queryByRole('button', { name: /sidebar/i })).not.toBeInTheDocument();
  });

  it('keeps the dice a plain press where there is only one kind to choose from', async () => {
    const user = userEvent.setup();
    const onSurprise = vi.fn();

    draw({ onSurprise, surpriseKinds: ['movies'] });

    await user.click(screen.getByRole('button', { name: 'Randomiser' }));

    expect(onSurprise).toHaveBeenCalledWith();
  });

  it('offers a choice of kind once the server holds more than one', async () => {
    const user = userEvent.setup();
    const onSurprise = vi.fn();

    draw({ onSurprise, surpriseKinds: ['movies', 'shows'] });

    await user.click(screen.getByRole('button', { name: 'Choose something at random' }));

    expect(await screen.findByRole('menuitem', { name: 'Anything' })).toBeInTheDocument();
    expect(await screen.findByRole('menuitem', { name: 'A programme' })).toBeInTheDocument();

    await user.click(await screen.findByRole('menuitem', { name: 'A film' }));

    expect(onSurprise).toHaveBeenCalledWith('movies');
  });

  it('names only the kinds the server actually holds', async () => {
    const user = userEvent.setup();

    draw({ onSurprise: vi.fn(), surpriseKinds: ['movies', 'shows'] });

    await user.click(screen.getByRole('button', { name: 'Choose something at random' }));

    await screen.findByRole('menuitem', { name: 'Anything' });

    expect(
      screen.queryByRole('menuitem', { name: 'Something to listen to' }),
    ).not.toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(AppShell.displayName).toBe('AppShell');
  });

  it('plays a film on the background dots for anybody who knows the code', async () => {
    const { view } = draw();

    enterTheCode();

    await waitFor(() => {
      expect(filmOf(view.container)).toBeInTheDocument();
    });
  });

  it('leaves somebody searching for it alone, however they spell what they searched for', () => {
    const { view } = draw({ section: 'search' });
    const field = document.createElement('input');

    document.body.append(field);
    enterTheCode(field);

    expect(filmOf(view.container)).not.toBeInTheDocument();

    field.remove();
  });

  it('does not play it at all for somebody who asked for less motion', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((media: string) => ({
        media,
        matches: media.includes('reduce'),
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    const { view } = draw();

    enterTheCode();

    expect(filmOf(view.container)).not.toBeInTheDocument();
  });

  it('stops it rather than carrying it into wherever the viewer goes next', async () => {
    const { view } = draw();

    enterTheCode();

    await waitFor(() => {
      expect(filmOf(view.container)).toBeInTheDocument();
    });

    view.rerender(
      <AppShell section="search" onSectionChange={vi.fn()}>
        <p>The library</p>
      </AppShell>,
    );

    await waitFor(() => {
      expect(filmOf(view.container)).not.toBeInTheDocument();
    });
  });

  it('leaves Escape to the film rather than navigating out from under it', async () => {
    const { props, view } = draw({ section: 'search' });

    enterTheCode();

    await waitFor(() => {
      expect(filmOf(view.container)).toBeInTheDocument();
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(props.onSectionChange).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(filmOf(view.container)).not.toBeInTheDocument();
    });
  });
});
