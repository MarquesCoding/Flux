import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chosenTheme } from '@ValenceClient/shell/theme';
import { AppShell } from './AppShell';

vi.mock('@ValenceUI/badAppleFilm', () => ({
  loadBadAppleFilm: async () =>
    Promise.resolve({
      seconds: 60,
      lift: (lifts: Float32Array) => {
        lifts.fill(1);
      },
    }),
}));
import { installPlatform } from '@ValenceClient/platform/installPlatform';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';
import type { AppShellProps } from './AppShell.types';

const draw = (overrides: Partial<AppShellProps> = {}) => {
  const props: AppShellProps = {
    section: 'home',
    onSectionChange: vi.fn(),
    isAccountOpen: false,
    onOpenAccount: vi.fn(),
    isAdminOpen: false,
    onOpenAdmin: vi.fn(),
    isDownloadsOpen: false,
    onOpenDownloads: vi.fn(),
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
  container.querySelector('[role="presentation"].valence-below-the-bar');

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

  it('hides administration from everyone who does not administer', async () => {
    const user = userEvent.setup();

    draw();

    await user.click(screen.getByRole('button', { name: 'Account' }));

    expect(await screen.findByRole('menuitem', { name: 'Account' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Admin' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('offers administration to someone who does, in the menu on their face', async () => {
    const user = userEvent.setup();
    const { props } = draw({ isAdministrator: true });

    await user.click(screen.getByRole('button', { name: 'Account' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Admin' }));

    expect(props.onOpenAdmin).toHaveBeenCalledOnce();
  });

  it('keeps administration off the bar itself, since it lives behind the face', () => {
    draw({ isAdministrator: true });

    expect(screen.queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('says which section the viewer is in', () => {
    draw({ section: 'search' });

    expect(screen.getByRole('button', { name: 'Search' })).toHaveAttribute('aria-current', 'page');
  });

  it('offers downloads on a client that can keep a file', () => {
    draw();

    expect(screen.getByRole('button', { name: 'Downloads' })).toBeInTheDocument();
  });

  it('offers no downloads in a browser, which cannot be trusted to keep one', () => {
    installPlatform(aFakePlatform({ canKeepFiles: () => false }));

    draw();

    expect(screen.queryByRole('button', { name: 'Downloads' })).not.toBeInTheDocument();
  });

  it('raises the account rather than going to it, since it is a dialog and not a section', async () => {
    const user = userEvent.setup();
    const { props } = draw();

    await user.click(screen.getByRole('button', { name: 'Account' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Account' }));

    expect(props.onOpenAccount).toHaveBeenCalledOnce();
    expect(props.onSectionChange).not.toHaveBeenCalled();
  });

  it('lights the face while the account is open, since no section is current then', () => {
    draw({ isAccountOpen: true });

    expect(
      screen.getByRole('button', { name: 'Account' }).closest('[data-highlight="account"]'),
    ).toHaveClass('text-text');
  });

  it('lights the face while the server dialog is open too, since that is where it was opened', () => {
    draw({ isAdministrator: true, isAdminOpen: true });

    expect(
      screen.getByRole('button', { name: 'Account' }).closest('[data-highlight="account"]'),
    ).toHaveClass('text-text');
  });

  it('leaves the face unlit while neither dialog is open', () => {
    draw();

    expect(
      screen.getByRole('button', { name: 'Account' }).closest('[data-highlight="account"]'),
    ).not.toHaveClass('text-text');
  });

  it('changes the theme from the menu on the face, marking the one in force', async () => {
    const user = userEvent.setup();

    draw();

    await user.click(screen.getByRole('button', { name: 'Account' }));

    const system = await screen.findByRole('menuitem', { name: /System/ });

    expect(within(system).getByText('✓')).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /Dark/ }));

    expect(chosenTheme()).toBe('dark');
  });

  it('signs out from the menu on the face', async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();

    draw({ onSignOut });

    await user.click(screen.getByRole('button', { name: 'Account' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('offers no way to sign out where the page was given none', async () => {
    const user = userEvent.setup();

    draw();

    await user.click(screen.getByRole('button', { name: 'Account' }));
    await screen.findByRole('menuitem', { name: 'Account' });

    expect(screen.queryByRole('menuitem', { name: 'Sign out' })).not.toBeInTheDocument();
  });

  it('lights the page with the colour of what is being shown', () => {
    const { view } = draw({ moodLights: [{ color: '#5a3c8c', at: '20% 30%' }] });

    const bloom = view.container.querySelector<HTMLElement>('.valence-bloom');

    expect(bloom?.style.background).toContain('#5a3c8c');
    expect(bloom?.style.background).toContain('20% 30%');
  });

  it('leaves room above every page for the bar laid over its top', () => {
    const { view } = draw();

    expect(view.container.querySelector('main')).toHaveClass('pt-[var(--nav-clearance)]');
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

    draw({ onSurprise, libraryKinds: ['movies'] });

    await user.click(screen.getByRole('button', { name: 'Randomiser' }));

    expect(onSurprise).toHaveBeenCalledWith();
  });

  it('offers a choice of kind once the server holds more than one', async () => {
    const user = userEvent.setup();
    const onSurprise = vi.fn();

    draw({ onSurprise, libraryKinds: ['movies', 'shows'] });

    await user.click(screen.getByRole('button', { name: 'Choose something at random' }));

    expect(await screen.findByRole('menuitem', { name: 'Anything' })).toBeInTheDocument();
    expect(await screen.findByRole('menuitem', { name: 'A programme' })).toBeInTheDocument();

    await user.click(await screen.findByRole('menuitem', { name: 'A film' }));

    expect(onSurprise).toHaveBeenCalledWith('movies');
  });

  it('names only the kinds the server actually holds', async () => {
    const user = userEvent.setup();

    draw({ onSurprise: vi.fn(), libraryKinds: ['movies', 'shows'] });

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
    const { view } = draw();
    const field = document.createElement('input');

    document.body.append(field);
    enterTheCode(field);

    expect(filmOf(view.container)).not.toBeInTheDocument();

    field.remove();
  });

  it('keeps the code to the home page, since that is the only page with dots to play it on', () => {
    const { view } = draw({ section: 'search' });

    enterTheCode();

    expect(filmOf(view.container)).not.toBeInTheDocument();
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
      <AppShell
        section="search"
        onSectionChange={vi.fn()}
        isAccountOpen={false}
        onOpenAccount={vi.fn()}
        isAdminOpen={false}
        onOpenAdmin={vi.fn()}
        isDownloadsOpen={false}
        onOpenDownloads={vi.fn()}
      >
        <p>The library</p>
      </AppShell>,
    );

    await waitFor(() => {
      expect(filmOf(view.container)).not.toBeInTheDocument();
    });
  });

  it('ends the film on Escape', async () => {
    const { view } = draw();

    enterTheCode();

    await waitFor(() => {
      expect(filmOf(view.container)).toBeInTheDocument();
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    await waitFor(() => {
      expect(filmOf(view.container)).not.toBeInTheDocument();
    });
  });

  it('offers a way out on screen, for a phone that has no Escape to press', async () => {
    const { view } = draw();

    enterTheCode();

    await waitFor(() => {
      expect(filmOf(view.container)).toBeInTheDocument();
    });

    const stop = screen.getByRole('button', { name: 'Stop the film' });

    await userEvent.click(stop);

    await waitFor(() => {
      expect(filmOf(view.container)).not.toBeInTheDocument();
    });
  });

  it('keeps that way out to itself until there is something to get out of', () => {
    draw();

    expect(screen.queryByRole('button', { name: 'Stop the film' })).not.toBeInTheDocument();
  });

  it('sits through a key that is not Escape rather than cutting the film short', async () => {
    const { view } = draw();

    enterTheCode();

    await waitFor(() => {
      expect(filmOf(view.container)).toBeInTheDocument();
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));
    });

    expect(filmOf(view.container)).toBeInTheDocument();
  });
});

describe('the places the bar offers', () => {
  const offered = (): string[] =>
    ['Home', 'Shows', 'Films', 'Books', 'New & Popular', 'Favourites'].filter(
      (name) =>
        within(screen.getByRole('navigation', { name: 'Sections' })).queryByRole('button', {
          name,
        }) !== null,
    );

  afterEach(() => {
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('offers every place until it is known which of them hold anything', () => {
    draw();

    expect(offered()).toEqual(['Home', 'Shows', 'Films', 'Books', 'New & Popular', 'Favourites']);
  });

  it('offers films, programmes and books only where they hold something', () => {
    draw({ stocked: ['films'] });

    expect(offered()).toEqual(['Home', 'Films', 'New & Popular', 'Favourites']);
  });

  it('keeps the places that are never empty however little there is', () => {
    draw({ stocked: [] });

    expect(offered()).toEqual(['Home', 'New & Popular', 'Favourites']);
  });

  it('hands its foot the places it offers, so the footer offers the same ones', () => {
    draw({
      stocked: ['films', 'read'],
      footer: (places) => <footer>{places.map((place) => place.label).join(', ')}</footer>,
    });

    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'Home, Films, Books, New & Popular, Favourites',
    );
  });

  it('says how far the page has come up towards the bar, so the sheet can fade in by it', () => {
    Object.defineProperty(window, 'scrollY', { value: 32, configurable: true });

    const { view } = draw();

    expect(
      view.container
        .querySelector<HTMLElement>('.valence-shell')
        ?.style.getPropertyValue('--content-reach'),
    ).toBe('0.5');
  });

  it('says nothing has come up yet at the top of the page', () => {
    const { view } = draw();

    expect(
      view.container
        .querySelector<HTMLElement>('.valence-shell')
        ?.style.getPropertyValue('--content-reach'),
    ).toBe('0');
  });
});
