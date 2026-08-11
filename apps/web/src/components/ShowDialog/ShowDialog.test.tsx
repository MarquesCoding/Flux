import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShowDialog } from './ShowDialog';
import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { ShowDetail, ShowSummary } from '@FluxContracts/schemas/Show';

const fetchShowMock = vi.hoisted(() => vi.fn());

vi.mock('@FluxWeb/library/fetchShows', () => ({
  fetchShow: fetchShowMock,
  fetchShows: vi.fn(),
}));

vi.mock('@FluxWeb/components/MediaPreview/MediaPreview', () => ({
  MediaPreview: () => <div data-testid="preview" />,
}));

const LIBRARY = '11111111-1111-4111-8111-111111111111';

const episode = (seasonNumber: number, episodeNumber: number): MediaSummary => ({
  id: `${seasonNumber.toString()}-${episodeNumber.toString()}`,
  libraryId: LIBRARY,
  title: `Episode ${episodeNumber.toString()}`,
  year: 2024,
  durationSeconds: 1400,
  width: 1920,
  height: 1080,
  videoCodec: 'h264',
  videoRange: 'SDR',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: false,
  hasBackdrop: false,
  seriesTitle: 'A Sign of Affection',
  seasonNumber,
  episodeNumber,
});

const summary: ShowSummary = {
  id: 'a-sign-of-affection',
  libraryId: LIBRARY,
  title: 'A Sign of Affection',
  seasonCount: 1,
  episodeCount: 3,
  latestAddedAt: '2026-08-10T00:00:00.000Z',
  coverMediaId: '9c858901-8a57-4791-81fe-4c455b099bc9',
  year: 2024,
  rating: 8.1,
  genres: [],
};

const detail = (seasons: { seasonNumber: number; episodes: number[] }[]): ShowDetail => ({
  ...summary,
  seasons: seasons.map((season) => ({
    seasonNumber: season.seasonNumber,
    episodes: season.episodes.map((number) => episode(season.seasonNumber, number)),
  })),
});

beforeEach(() => {
  fetchShowMock.mockReset();
});

describe('ShowDialog', () => {
  it('lists the episodes it holds', async () => {
    fetchShowMock.mockResolvedValue(detail([{ seasonNumber: 1, episodes: [1, 2, 3] }]));
    render(<ShowDialog show={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(await screen.findByRole('button', { name: /Play Episode 1/ })).toBeInTheDocument();
  });

  it('shows the hole where a missing episode belongs', async () => {
    fetchShowMock.mockResolvedValue(detail([{ seasonNumber: 1, episodes: [1, 2, 4] }]));
    render(<ShowDialog show={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(await screen.findByText('Not in this library')).toBeInTheDocument();
    expect(screen.getByText('Episode 3')).toBeInTheDocument();
  });

  it('puts the missing episode in its own place in the order', async () => {
    fetchShowMock.mockResolvedValue(detail([{ seasonNumber: 1, episodes: [1, 2, 4] }]));
    render(<ShowDialog show={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    await screen.findByText('Not in this library');

    const rows = screen.getAllByRole('listitem');
    const missingAt = rows.findIndex(
      (row) => within(row).queryByText('Not in this library') !== null,
    );
    const fourthAt = rows.findIndex(
      (row) => within(row).queryByRole('button', { name: /Play Episode 4/ }) !== null,
    );

    expect(missingAt).toBeGreaterThan(0);
    expect(missingAt).toBeLessThan(fourthAt);
  });

  it('says nothing about gaps in a season that has none', async () => {
    fetchShowMock.mockResolvedValue(detail([{ seasonNumber: 1, episodes: [1, 2, 3] }]));
    render(<ShowDialog show={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    await screen.findByRole('button', { name: /Play Episode 1/ });

    expect(screen.queryByText('Not in this library')).not.toBeInTheDocument();
  });

  it('names a season it does not hold at all', async () => {
    fetchShowMock.mockResolvedValue(
      detail([
        { seasonNumber: 1, episodes: [1] },
        { seasonNumber: 3, episodes: [1] },
      ]),
    );
    render(<ShowDialog show={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(await screen.findByText('Season 2 missing')).toBeInTheDocument();
  });

  it('offers no way into a season that is not there', async () => {
    fetchShowMock.mockResolvedValue(
      detail([
        { seasonNumber: 1, episodes: [1] },
        { seasonNumber: 3, episodes: [1] },
      ]),
    );
    render(<ShowDialog show={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    await screen.findByText('Season 2 missing');

    expect(screen.queryByRole('button', { name: 'Season 2' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Season 1' })).toBeInTheDocument();
  });

  it('plays the episode that was pressed', async () => {
    const onPlay = vi.fn();
    const user = userEvent.setup();
    fetchShowMock.mockResolvedValue(detail([{ seasonNumber: 1, episodes: [1, 2] }]));
    render(<ShowDialog show={summary} onClose={vi.fn()} onPlay={onPlay} />);

    await user.click(await screen.findByRole('button', { name: /Play Episode 2/ }));

    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ title: 'Episode 2' }), 0);
  });

  it('closes when asked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    fetchShowMock.mockResolvedValue(detail([{ seasonNumber: 1, episodes: [1] }]));
    render(<ShowDialog show={summary} onClose={onClose} onPlay={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('draws nothing at all when no show is open', () => {
    const { container } = render(<ShowDialog show={null} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('asks for the series it was given', async () => {
    fetchShowMock.mockResolvedValue(detail([{ seasonNumber: 1, episodes: [1] }]));
    render(<ShowDialog show={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    await waitFor(() => {
      expect(fetchShowMock).toHaveBeenCalledWith(LIBRARY, 'a-sign-of-affection');
    });
  });

  it('sets a display name so devtools can identify it', () => {
    expect(ShowDialog.displayName).toBe('ShowDialog');
  });
});
