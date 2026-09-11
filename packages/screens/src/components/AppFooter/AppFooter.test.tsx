import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInAnAddress } from '@ValenceScreens/testing/renderInAnAddress';
import { AppFooter } from './AppFooter';
import type { AppFooterProps } from './AppFooter.types';

type Facets = { genres: string[]; decades: number[]; maxRating: number };

const fetchFacets = vi.fn<() => Promise<Facets>>();

const readVersion = vi.fn<() => Promise<string>>();

vi.mock('@ValenceClient/library/fetchFacets', () => ({
  fetchFacets: () => fetchFacets(),
}));

vi.mock('@ValenceClient/session/readVersion', () => ({
  readVersion: () => readVersion(),
  describeVersion: (reported: string) => reported,
  LOCAL: 'local.dev',
}));

const PLACES: AppFooterProps['places'] = [
  { id: 'home', label: 'Home' },
  { id: 'films', label: 'Films' },
  { id: 'favourites', label: 'Favourites' },
];

const draw = (overrides: Partial<AppFooterProps> = {}) => {
  const props: AppFooterProps = {
    places: PLACES,
    onPlace: vi.fn(),
    onGenre: vi.fn(),
    onAccount: vi.fn(),
    onSignOut: vi.fn(),
    ...overrides,
  };

  const view = renderInAnAddress(<AppFooter {...props} />);

  return { props, view };
};

beforeEach(() => {
  fetchFacets.mockReset().mockResolvedValue({
    genres: ['Action', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Thriller', 'Western'],
    decades: [],
    maxRating: 10,
  });
  readVersion.mockReset().mockResolvedValue('1.2.3');
});

describe('AppFooter', () => {
  it('offers the places the bar offers, in the same order', async () => {
    const actor = userEvent.setup();
    const { props } = draw();

    const browse = screen.getByRole('navigation', { name: 'Browse' });

    expect(
      within(browse)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Home', 'Films', 'Favourites']);

    await actor.click(within(browse).getByRole('button', { name: 'Films' }));

    expect(props.onPlace).toHaveBeenCalledWith('films');
  });

  it('offers the first six genres the library holds, and looks through one when pressed', async () => {
    const actor = userEvent.setup();
    const { props } = draw();

    const genres = await screen.findByRole('navigation', { name: 'Genres' });

    expect(within(genres).getAllByRole('button')).toHaveLength(6);
    expect(within(genres).queryByRole('button', { name: 'Thriller' })).not.toBeInTheDocument();

    await actor.click(within(genres).getByRole('button', { name: 'Drama' }));

    expect(props.onGenre).toHaveBeenCalledWith('Drama');
  });

  it('leaves the genres out where the library holds none', async () => {
    fetchFacets.mockResolvedValue({ genres: [], decades: [], maxRating: 0 });

    draw();

    await screen.findByText(/1\.2\.3/);

    expect(screen.queryByRole('navigation', { name: 'Genres' })).not.toBeInTheDocument();
  });

  it('opens each part of the account it names', async () => {
    const actor = userEvent.setup();
    const { props } = draw();

    const account = screen.getByRole('navigation', { name: 'Account' });

    await actor.click(within(account).getByRole('button', { name: 'Your account' }));
    await actor.click(within(account).getByRole('button', { name: 'Password and sign-in' }));
    await actor.click(within(account).getByRole('button', { name: 'Devices' }));

    expect(vi.mocked(props.onAccount).mock.calls).toEqual([['profile'], ['security'], ['devices']]);
  });

  it('offers the server settings only to somebody who runs the server', async () => {
    const actor = userEvent.setup();
    const onAdmin = vi.fn();

    const { view } = draw();

    expect(screen.queryByRole('button', { name: 'Server settings' })).not.toBeInTheDocument();

    view.unmount();

    draw({ onAdmin });

    await actor.click(screen.getByRole('button', { name: 'Server settings' }));

    expect(onAdmin).toHaveBeenCalledOnce();
  });

  it('signs out', async () => {
    const actor = userEvent.setup();
    const { props } = draw();

    await actor.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(props.onSignOut).toHaveBeenCalledOnce();
  });

  it('names the version the server is running', async () => {
    draw();

    const version = await screen.findByText(/1\.2\.3/);

    expect(version.closest('p')).toHaveTextContent(
      `© ${new Date().getFullYear().toString()} Valence · 1.2.3`,
    );
  });

  it('leads to the API reference the server publishes', () => {
    draw();

    expect(screen.getByRole('link', { name: 'API reference' })).toHaveAttribute(
      'href',
      '/api/reference',
    );
  });

  it('closes on the name set large and fading, kept from anybody reading it aloud', () => {
    const { view } = draw();

    const wordmark = view.container.querySelector('footer > p[aria-hidden]');

    expect(wordmark).toHaveTextContent('Valence');
    expect(wordmark).toHaveClass('text-transparent', 'bg-clip-text');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(AppFooter.displayName).toBe('AppFooter');
  });
});
