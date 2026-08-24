import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetPlatform } from '@ValenceClient/platform/installPlatform';
import { renderInAnAddress } from '@ValenceScreens/testing/renderInAnAddress';
import { installATestClient } from '@ValenceScreens/testing/installATestClient';
import type { Reachability } from '@ValenceClient/platform/Platform.types';
import { ValenceRoot } from './ValenceRoot';

const sendWatchedOffline = vi.fn<() => Promise<number>>();

vi.mock('@ValenceClient/offline/watchedOffline', () => ({
  sendWatchedOffline: () => sendWatchedOffline(),
}));

const outOfReach: Reachability = {
  isReachable: () => false,
  whenChanged: () => () => {},
};

const fetchMock = vi.fn();

beforeEach(() => {
  installATestClient();
  sendWatchedOffline.mockReset().mockResolvedValue(0);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ isComplete: true }),
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  forgetPlatform();
  vi.unstubAllGlobals();
});

describe('ValenceRoot', () => {
  it('draws the small application where there is no server', async () => {
    installATestClient({ reachability: outOfReach });

    renderInAnAddress(<ValenceRoot initialTitle="Valence" />);

    await waitFor(() => {
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });

  it('asks the server nothing at all while it is offline', async () => {
    installATestClient({ reachability: outOfReach });

    renderInAnAddress(<ValenceRoot initialTitle="Valence" />);

    await waitFor(() => {
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('draws the ordinary application where the server is answering', async () => {
    renderInAnAddress(<ValenceRoot initialTitle="Valence" />);

    await waitFor(() => {
      expect(screen.queryByText('Offline')).not.toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('tells the server nothing on the way up, having never been offline', async () => {
    renderInAnAddress(<ValenceRoot initialTitle="Valence" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(sendWatchedOffline).not.toHaveBeenCalled();
  });
});
