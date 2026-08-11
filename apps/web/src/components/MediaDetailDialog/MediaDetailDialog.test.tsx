import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaDetailDialog } from './MediaDetailDialog';
import type { MediaDetail, MediaSummary } from '@FluxContracts/schemas/Library';

const detailMock = vi.hoisted(() => vi.fn());

vi.mock('@FluxWeb/library/fetchLibrary', () => ({
  fetchMediaDetail: detailMock,
}));

vi.mock('@FluxWeb/components/MediaPreview/MediaPreview', () => ({
  MediaPreview: () => <div>preview</div>,
}));

const summary: MediaSummary = {
  id: 'media-1',
  libraryId: 'library-1',
  title: 'Arrival',
  year: 2016,
  durationSeconds: 7200,
  width: 1920,
  height: 1080,
  videoCodec: 'hevc',
  videoRange: 'HDR10',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: true,
  hasBackdrop: true,
};

const detail = (overrides: Partial<MediaDetail['metadata']> = {}): MediaDetail => ({
  id: 'media-1',
  libraryId: 'library-1',
  title: 'Arrival',
  year: 2016,
  container: 'mkv',
  durationSeconds: 7200,
  videoCodec: 'hevc',
  videoRange: 'HDR10',
  width: 1920,
  height: 1080,
  bitrateKbps: 12000,
  audioStreams: [],
  subtitleStreams: [],
  addedAt: '2026-08-10T00:00:00.000Z',
  metadata: { hasPoster: true, hasBackdrop: true, ...overrides },
});

beforeEach(() => {
  detailMock.mockReset();
  detailMock.mockResolvedValue(detail());
});

describe('MediaDetailDialog', () => {
  it('shows nothing when nothing was chosen', () => {
    render(<MediaDetailDialog media={null} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('names itself after the item', () => {
    render(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Arrival' })).toBeInTheDocument();
  });

  it('shows what is known before any details arrive', () => {
    render(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument();
    expect(screen.getByText('2016')).toBeInTheDocument();
    expect(screen.getByText('2:00:00')).toBeInTheDocument();
  });

  it('shows the overview once it arrives', async () => {
    detailMock.mockResolvedValue(detail({ overview: 'A linguist meets visitors.' }));
    render(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(await screen.findByText('A linguist meets visitors.')).toBeInTheDocument();
  });

  it('names the cast with their roles', async () => {
    detailMock.mockResolvedValue(
      detail({ cast: [{ name: 'Amy Adams', role: 'Louise Banks', imageUrl: null }] }),
    );
    render(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(await screen.findByText('Amy Adams')).toBeInTheDocument();
    expect(screen.getByText('Louise Banks')).toBeInTheDocument();
  });

  it('says why the cast is empty rather than leaving a blank space', async () => {
    render(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    await waitFor(() => {
      expect(detailMock).toHaveBeenCalled();
    });

    expect(screen.getByRole('heading', { name: 'Cast' })).toBeInTheDocument();
    expect(await screen.findByText(/metadata provider supplies the cast/)).toBeInTheDocument();
  });

  it('says why there is no synopsis rather than showing an empty paragraph', async () => {
    render(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(await screen.findByText(/Configure a metadata provider/)).toBeInTheDocument();
  });

  it('holds the shape of what is coming while it loads', () => {
    detailMock.mockReturnValue(new Promise(() => undefined));
    render(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    // Content that lands in a space already the right size does not shove the
    // rest of the panel down the page. Searched from the document rather than
    // the render container, because a dialog is drawn in a portal.
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('says which episode this is when it is one', async () => {
    detailMock.mockResolvedValue(detail({ seasonNumber: 2, episodeNumber: 5 }));
    render(
      <MediaDetailDialog
        media={{ ...summary, seriesTitle: 'Story of Us', seasonNumber: 2, episodeNumber: 5 }}
        onClose={vi.fn()}
        onPlay={vi.fn()}
      />,
    );

    // Said the way every other card and the hero say it, rather than in a
    // sentence of its own.
    expect(await screen.findByText('EP5')).toBeInTheDocument();
    expect(screen.getByText('S2')).toBeInTheDocument();

    // The show is the heading and the episode is the line above it.
    expect(screen.getByRole('heading', { name: 'Story of Us' })).toBeInTheDocument();
  });

  it('offers the rest of the season', async () => {
    detailMock.mockResolvedValue(detail({ seasonNumber: 2, episodeNumber: 5 }));
    render(
      <MediaDetailDialog
        media={summary}
        onClose={vi.fn()}
        onPlay={vi.fn()}
        siblings={[{ ...summary, id: 'media-2', title: 'The Next One' }]}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'More from season 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /The Next One/ })).toBeInTheDocument();
  });

  it('moves to another episode on request', async () => {
    const onSelectSibling = vi.fn();
    const user = userEvent.setup();
    const sibling = { ...summary, id: 'media-2', title: 'The Next One' };

    render(
      <MediaDetailDialog
        media={summary}
        onClose={vi.fn()}
        onPlay={vi.fn()}
        siblings={[sibling]}
        onSelectSibling={onSelectSibling}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /The Next One/ }));

    expect(onSelectSibling).toHaveBeenCalledWith(sibling);
  });

  it('plays on request', async () => {
    const onPlay = vi.fn();
    const user = userEvent.setup();
    render(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={onPlay} />);

    await user.click(screen.getByRole('button', { name: 'Play' }));

    // From the beginning, since nobody has watched any of it. Where a viewer
    // has, the same button says resume and names the second to start at.
    expect(onPlay).toHaveBeenCalledWith(summary, 0);
  });

  it('closes on request', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<MediaDetailDialog media={summary} onClose={onClose} onPlay={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('remains readable when the details cannot be loaded at all', async () => {
    detailMock.mockResolvedValue(null);
    render(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    await waitFor(() => {
      expect(detailMock).toHaveBeenCalled();
    });

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(MediaDetailDialog.displayName).toBe('MediaDetailDialog');
  });
});
