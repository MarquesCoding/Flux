import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aFakeHeldFiles } from '@ValenceClient/testing/aFakeHeldFiles';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';
import { forgetPlatform, installPlatform } from '@ValenceClient/platform/installPlatform';
import type { Platform, Reachability } from '@ValenceClient/platform/Platform.types';
import type { HeldFile } from '@ValenceContracts/schemas/HeldFile';
import '@ValenceDesktop/TheWindow.types';

vi.mock('@ValenceScreens/routes/buildRouter', () => ({ buildRouter: () => ({}) }));

vi.mock('@tanstack/react-router', () => ({
  RouterProvider: () => <div data-testid="the-application" />,
}));

const { Desktop } = await import('./Desktop');

const THE_ADDRESS = 'valence.server.address';

const aFilm = (): HeldFile => ({
  downloadId: '2b2b7f7e-2f0e-4a5e-9c2f-2b9b1e1f0a11',
  mediaId: '9c858901-8a57-4791-81fe-4c455b099bc9',
  seriesId: null,
  seriesTitle: null,
  title: 'The Third Man',
  quality: 'original',
  durationSeconds: 5940,
  ofBytes: 100,
  state: 'here',
  bytes: 100,
  bytesPerSecond: null,
  failure: null,
  keptAt: '2026-08-22T00:00:00.000Z',
  hasPoster: true,
});

const unreachable: Reachability = {
  isReachable: () => false,
  whenChanged: () => () => {},
};

const theWindowOffers = (found: string[]): void => {
  window.valence = {
    preferences: { held: {}, write: () => {}, forget: () => {} },
    goToTheServer: () => {},
    held: {
      all: () => Promise.resolve([]),
      keep: () => Promise.resolve(),
      drop: () => Promise.resolve(),
      pause: () => Promise.resolve(),
      whenChanged: () => () => {},
    },
    reach: { now: () => true, whenChanged: () => () => {} },
    servers: { alreadyFound: found, whenFound: () => () => {} },
  };
};

const aClient = (overrides: Partial<Platform> = {}, chosen: string | null = null): void => {
  const platform = aFakePlatform(overrides);

  if (chosen !== null) {
    platform.store.write(THE_ADDRESS, chosen);
  }

  installPlatform(platform);
};

const asking = (): HTMLElement | null =>
  screen.queryByRole('heading', { name: 'Which Valence is yours?' });

beforeEach(() => {
  theWindowOffers([]);
});

afterEach(() => {
  forgetPlatform();
});

describe('Desktop', () => {
  it('asks which Valence is yours on a fresh install, offering the one on this machine', async () => {
    theWindowOffers(['http://localhost:8420']);
    aClient();

    render(<Desktop />);

    expect(asking()).not.toBeNull();
    expect(screen.getByRole('button', { name: 'localhost:8420' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId('the-application')).toBeNull();
    });
  });

  it('asks for an address where nothing was found on this machine', () => {
    aClient();

    render(<Desktop />);

    expect(asking()).not.toBeNull();
    expect(screen.queryByText('Found on this machine')).toBeNull();
    expect(screen.getByLabelText('Server address')).toBeInTheDocument();
  });

  it('asks on a fresh install even where nothing is answering, rather than drawing an empty shelf', async () => {
    aClient({ reachability: unreachable });

    render(<Desktop />);

    await waitFor(() => {
      expect(asking()).not.toBeNull();
    });

    expect(screen.queryByTestId('the-application')).toBeNull();
  });

  it('draws the application once a server has been chosen and is answering', async () => {
    aClient({}, 'http://valence.example');

    render(<Desktop />);

    await waitFor(() => {
      expect(screen.getByTestId('the-application')).toBeInTheDocument();
    });

    expect(asking()).toBeNull();
  });

  it('asks again where the chosen server stopped answering and nothing is on this device', async () => {
    aClient({ reachability: unreachable }, 'http://valence.example');

    render(<Desktop />);

    await waitFor(() => {
      expect(asking()).not.toBeNull();
    });

    expect(screen.getByDisplayValue('http://valence.example')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Valence at http://valence.example could not be reached. Check that it is running.',
      ),
    ).toBeInTheDocument();
  });

  it('leaves somebody with downloads in offline mode rather than asking them again', async () => {
    aClient(
      { reachability: unreachable, held: aFakeHeldFiles([aFilm()]).held },
      'http://valence.example',
    );

    render(<Desktop />);

    await waitFor(() => {
      expect(screen.getByTestId('the-application')).toBeInTheDocument();
    });

    expect(asking()).toBeNull();
  });
});
