import { screen, waitFor } from '@testing-library/react';
import { z } from 'zod';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatBytes } from '@ValenceCore/functions/formatBytes';
import { renderInAnAddress } from '@ValenceScreens/testing/renderInAnAddress';
import { DownloadList } from './DownloadList';

const READY = {
  id: '00000000-0000-4000-8000-000000000001',
  mediaId: '00000000-0000-4000-8000-000000000002',
  seriesId: null,
  seriesTitle: null,
  title: 'Arrival',
  quality: '1080p',
  audioLanguages: [],
  state: 'ready',
  progress: 1,
  bytesPerSecond: null,
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

  it('says a queued one is waiting rather than leaving it looking stuck', async () => {
    drawWith([{ ...READY, state: 'queued', progress: 0, sizeBytes: null, readyAt: null }]);

    expect(await screen.findByText(/Waiting its turn/)).toBeInTheDocument();
  });

  it('says a paused one keeps what it has done, which is the worry somebody has', async () => {
    drawWith([{ ...READY, state: 'paused', progress: 0.4, sizeBytes: null, readyAt: null }]);

    expect(await screen.findByText(/Paused at 40%. What is done is kept/)).toBeInTheDocument();
  });

  it('offers to stop one that is being prepared', async () => {
    drawWith([PREPARING]);

    expect(
      await screen.findByRole('button', { name: /Stop preparing Arrival for now/ }),
    ).toBeInTheDocument();
  });

  it('offers to carry on with one that is paused', async () => {
    drawWith([{ ...READY, state: 'paused', progress: 0.4, sizeBytes: null, readyAt: null }]);

    expect(
      await screen.findByRole('button', { name: /Carry on preparing Arrival/ }),
    ).toBeInTheDocument();
  });

  it('offers neither on one that is already done', async () => {
    drawWith([READY]);

    await screen.findByText('Arrival');

    expect(screen.queryByRole('button', { name: /Stop preparing/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Carry on preparing/ })).not.toBeInTheDocument();
  });

  it('asks the server to pause when told to', async () => {
    const actor = userEvent.setup();

    drawWith([PREPARING]);

    await actor.click(await screen.findByRole('button', { name: /Stop preparing Arrival/ }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).endsWith(`/${PREPARING.id}/pause`)),
      ).toBe(true);
    });
  });

  it('gathers a queued programme under its own name, with how much of it is ready', async () => {
    drawWith([
      { ...READY, seriesId: 'a-show', seriesTitle: 'The Bear' },
      {
        ...READY,
        id: '00000000-0000-4000-8000-000000000005',
        seriesId: 'a-show',
        seriesTitle: 'The Bear',
        state: 'queued',
      },
    ]);

    expect(await screen.findByText('The Bear')).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 ready/)).toBeInTheDocument();
  });

  it('leaves a film to stand on its own, since it belongs to no programme', async () => {
    drawWith([READY]);

    await screen.findByText('Arrival');

    expect(screen.queryByText(/of 1 ready/)).not.toBeInTheDocument();
  });

  it('says how fast it is going, in the unit people read every other transfer in', async () => {
    drawWith([{ ...PREPARING, bytesPerSecond: 8_000_000 }]);

    expect(await screen.findByText(new RegExp(`${formatBytes(8_000_000)}/s`))).toBeInTheDocument();
  });

  it('says nothing about speed before there is a rate worth quoting', async () => {
    drawWith([PREPARING]);

    await screen.findByText(/40% done/);

    expect(screen.queryByText(/MB\/s/)).not.toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(DownloadList.displayName).toBe('DownloadList');
  });
});
