import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { formatBytes } from '@ValenceCore/functions/formatBytes';
import { renderInAnAddress } from '@ValenceScreens/testing/renderInAnAddress';
import { DownloadDialog } from './DownloadDialog';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';

const MEDIA: MediaSummary = {
  id: '00000000-0000-4000-8000-000000000002',
  libraryId: '00000000-0000-4000-8000-000000000009',
  title: 'Arrival',
  year: 2016,
  durationSeconds: 7200,
  width: 1920,
  height: 1080,
  videoCodec: 'h264',
  videoRange: 'SDR',
  seriesId: null,
  addedAt: '2026-01-01T00:00:00.000Z',
  hasPoster: false,
  hasBackdrop: false,
  hasLogo: false,
};

const OFFER = {
  mediaId: MEDIA.id,
  title: 'Arrival',
  options: [
    {
      quality: 'original',
      label: 'Original',
      meaning: 'Exactly what is on the server.',
      bytes: 60_000_000_000,
      comparison: null,
      wouldTranscode: true,
    },
    {
      quality: '1080p',
      label: '1080p',
      meaning: 'Looks great on a TV.',
      bytes: 4_000_000_000,
      comparison: 'a small fraction of the original — about a 15th',
      wouldTranscode: true,
    },
  ],
};

const RequestSchema = z.object({ body: z.string().optional(), method: z.string().optional() });

const fetchMock = vi.fn();

/**
 * A browser that says how much room it has.
 *
 * @param freeBytes - What to report, or nothing to decline.
 */
const deviceWith = (freeBytes: number | null) => {
  vi.stubGlobal('navigator', {
    ...navigator,
    storage: {
      estimate: () =>
        freeBytes === null
          ? Promise.reject(new Error('no'))
          : Promise.resolve({ quota: freeBytes, usage: 0 }),
    },
  });
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(OFFER) });
  vi.stubGlobal('fetch', fetchMock);
  deviceWith(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DownloadDialog', () => {
  it('is shut when nothing was chosen to download', () => {
    renderInAnAddress(<DownloadDialog media={null} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers every rung with what it would cost', async () => {
    renderInAnAddress(<DownloadDialog media={MEDIA} onClose={vi.fn()} />);

    expect(await screen.findByText('Original')).toBeInTheDocument();
    expect(screen.getByText('1080p')).toBeInTheDocument();
    expect(screen.getByText(formatBytes(60_000_000_000))).toBeInTheDocument();
  });

  it('reads a rung against the original, which is the comparison somebody opened this to make', async () => {
    renderInAnAddress(<DownloadDialog media={MEDIA} onClose={vi.fn()} />);

    expect(await screen.findByText(/about a 15th/)).toBeInTheDocument();
  });

  it('says plainly when the device would have to convert it first', async () => {
    renderInAnAddress(<DownloadDialog media={MEDIA} onClose={vi.fn()} />);

    expect((await screen.findAllByText('converted first')).length).toBeGreaterThan(0);
  });

  it('reads the size against the room left, where the device will say', async () => {
    deviceWith(200_000_000_000);

    renderInAnAddress(<DownloadDialog media={MEDIA} onClose={vi.fn()} />);

    expect(
      await screen.findByText(new RegExp(`${formatBytes(200_000_000_000)} free`)),
    ).toBeInTheDocument();
  });

  it('refuses what will not fit, before the transfer rather than part way through', async () => {
    deviceWith(10_000_000_000);

    renderInAnAddress(<DownloadDialog media={MEDIA} onClose={vi.fn()} />);

    expect(await screen.findByText(/will not fit/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Prepare it/ })).toBeDisabled();
  });

  it('warns rather than refuses when it would take most of what is left', async () => {
    deviceWith(70_000_000_000);

    renderInAnAddress(<DownloadDialog media={MEDIA} onClose={vi.fn()} />);

    expect(await screen.findByText(/most of what is left/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Prepare it/ })).toBeEnabled();
  });

  it('says nothing about room where the device would not say how much it has', async () => {
    renderInAnAddress(<DownloadDialog media={MEDIA} onClose={vi.fn()} />);

    await screen.findByText('Original');

    expect(screen.queryByText(/free/)).not.toBeInTheDocument();
  });

  it('asks for the rung that was chosen rather than the one on top', async () => {
    const actor = userEvent.setup();

    renderInAnAddress(<DownloadDialog media={MEDIA} onClose={vi.fn()} />);

    await actor.click(
      (await screen.findAllByRole('button', { name: 'Choose' }))[0] ?? new HTMLElement(),
    );
    await actor.click(screen.getByRole('button', { name: /Prepare it/ }));

    await waitFor(() => {
      const asking = fetchMock.mock.calls.find(([url]) =>
        String(url).endsWith(`/api/media/${MEDIA.id}/downloads`),
      );

      expect(JSON.parse(String(RequestSchema.parse(asking?.[1]).body))).toMatchObject({
        quality: '1080p',
      });
    });
  });

  it('sets a display name so devtools can identify it', () => {
    expect(DownloadDialog.displayName).toBe('DownloadDialog');
  });
});
