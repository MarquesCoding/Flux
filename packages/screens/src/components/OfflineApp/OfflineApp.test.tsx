import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { forgetPlatform } from '@ValenceClient/platform/installPlatform';
import { aFakeHeldFiles } from '@ValenceClient/testing/aFakeHeldFiles';
import { installATestClient } from '@ValenceScreens/testing/installATestClient';
import type { HeldFile } from '@ValenceContracts/schemas/HeldFile';
import type { Reachability } from '@ValenceClient/platform/Platform.types';
import { OfflineApp } from './OfflineApp';

const aFile = (over: Partial<HeldFile> = {}): HeldFile => ({
  downloadId: '00000000-0000-4000-8000-000000000001',
  mediaId: '00000000-0000-4000-8000-000000000002',
  seriesId: null,
  seriesTitle: null,
  title: 'The Third Man',
  quality: 'original',
  durationSeconds: 5940,
  ofBytes: 1_073_741_824,
  state: 'here',
  bytes: 1_073_741_824,
  bytesPerSecond: null,
  failure: null,
  keptAt: '2026-08-22T00:00:00.000Z',
  hasPoster: false,
  ...over,
});

const outOfReach: Reachability = {
  isReachable: () => false,
  whenChanged: () => () => {},
};

beforeEach(() => {
  installATestClient();
});

afterEach(() => {
  forgetPlatform();
});

describe('OfflineApp', () => {
  it('says which Valence this is, even with no server to ask', () => {
    render(<OfflineApp title="Kestrel" />);

    expect(screen.getByRole('heading', { name: 'Kestrel' })).toBeInTheDocument();
  });

  it('says it is offline', () => {
    render(<OfflineApp title="Valence" />);

    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('says the server cannot be reached when that is why', () => {
    installATestClient({ reachability: outOfReach });

    render(<OfflineApp title="Valence" />);

    expect(screen.getByText(/Valence is not reachable/)).toBeInTheDocument();
  });

  it('says it was asked for when the server is answering fine', () => {
    render(<OfflineApp title="Valence" />);

    expect(screen.getByText(/Offline because you asked/)).toBeInTheDocument();
  });

  it('offers no way back while there is nothing to go back to', () => {
    installATestClient({ reachability: outOfReach });

    render(<OfflineApp title="Valence" />);

    expect(screen.queryByRole('button', { name: /online|Reconnect/ })).not.toBeInTheDocument();
  });

  it('offers the way back once the server is answering', () => {
    render(<OfflineApp title="Valence" />);

    expect(screen.getByRole('button', { name: /Reconnect|Go back online/ })).toBeInTheDocument();
  });

  it('shows what is on the disk', async () => {
    installATestClient({ held: aFakeHeldFiles([aFile()]).held });

    render(<OfflineApp title="Valence" />);

    await waitFor(() => {
      expect(screen.getByText('The Third Man')).toBeInTheDocument();
    });
  });

  it('offers no search, no account and no admin, because none of them exist here', async () => {
    installATestClient({ held: aFakeHeldFiles([aFile()]).held });

    render(<OfflineApp title="Valence" />);

    await waitFor(() => {
      expect(screen.getByText('The Third Man')).toBeInTheDocument();
    });

    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Search|Account|Admin/ })).not.toBeInTheDocument();
  });

  it('plays one when it is chosen, and comes back again', async () => {
    installATestClient({ held: aFakeHeldFiles([aFile()]).held });

    render(<OfflineApp title="Valence" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Watch/ })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /Watch/ }));

    expect(screen.getByRole('heading', { name: 'The Third Man' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Back to downloads' }));

    expect(screen.getByRole('heading', { name: 'Valence' })).toBeInTheDocument();
  });

  it('lets go of something without a server being involved', async () => {
    const files = aFakeHeldFiles([aFile()]);

    installATestClient({ held: files.held });

    render(<OfflineApp title="Valence" />);

    await waitFor(() => {
      expect(screen.getByText('The Third Man')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /Remove The Third Man/ }));

    await waitFor(() => {
      expect(files.dropped).toEqual(['00000000-0000-4000-8000-000000000001']);
    });
  });
});
