import { screen, waitFor } from '@testing-library/react';
import { z } from 'zod';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInAnAddress } from '@ValenceScreens/testing/renderInAnAddress';
import { DownloadList } from './DownloadList';

const READY = {
  id: '00000000-0000-4000-8000-000000000001',
  mediaId: '00000000-0000-4000-8000-000000000002',
  title: 'Arrival',
  quality: '1080p',
  audioLanguages: [],
  state: 'ready',
  progress: 1,
  sizeBytes: 4_000_000_000,
  failure: null,
  askedAt: '2026-01-01T00:00:00.000Z',
  readyAt: '2026-01-01T00:10:00.000Z',
};

const PREPARING = {
  ...READY,
  id: '00000000-0000-4000-8000-000000000003',
  state: 'preparing',
  progress: 0.4,
  sizeBytes: null,
  readyAt: null,
};

const FAILED = {
  ...READY,
  id: '00000000-0000-4000-8000-000000000004',
  state: 'failed',
  failure: 'The media service could not be reached.',
};

const RequestSchema = z.object({ method: z.string().optional() });

const fetchMock = vi.fn();

/**
 * Draws the list with the server answering with these downloads.
 *
 * @param downloads - What the server holds.
 */
const drawWith = (downloads: object[]) => {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ downloads }),
  });

  renderInAnAddress(<DownloadList />);
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DownloadList', () => {
  it('says there is nothing yet, and where one would come from', async () => {
    drawWith([]);

    expect(await screen.findByText(/Nothing prepared yet/)).toBeInTheDocument();
  });

  it('names what has been prepared and how large it turned out', async () => {
    drawWith([READY]);

    expect(await screen.findByText('Arrival')).toBeInTheDocument();
    expect(screen.getByText(/Ready to fetch/)).toBeInTheDocument();
  });

  it('says how far along something still being prepared is', async () => {
    drawWith([PREPARING]);

    expect(await screen.findByText(/40% done/)).toBeInTheDocument();
  });

  it('says why one failed rather than only that it did', async () => {
    drawWith([FAILED]);

    expect(await screen.findByText(/could not be reached/)).toBeInTheDocument();
  });

  it('offers to fetch only what is ready', async () => {
    drawWith([PREPARING]);

    await screen.findByText(/40% done/);

    expect(screen.queryByRole('button', { name: /Fetch/ })).not.toBeInTheDocument();
  });

  it('offers to stop keeping one on the server, saying which', async () => {
    drawWith([READY]);

    expect(
      await screen.findByRole('button', { name: /Stop keeping Arrival on the server/ }),
    ).toBeInTheDocument();
  });

  it('asks the server to forget it when told to', async () => {
    const actor = userEvent.setup();

    drawWith([READY]);

    await actor.click(
      await screen.findByRole('button', { name: /Stop keeping Arrival on the server/ }),
    );

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url).includes(READY.id) && RequestSchema.parse(init).method === 'DELETE',
        ),
      ).toBe(true);
    });
  });

  it('sets a display name so devtools can identify it', () => {
    expect(DownloadList.displayName).toBe('DownloadList');
  });
});
