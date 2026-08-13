import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShowDialog } from './ShowDialog';
import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { ShowDetail, ShowSummary } from '@FluxContracts/schemas/Show';
import type * as MotionReact from 'motion/react';

const motion = vi.hoisted(() => ({ isReduced: false }));

vi.mock('motion/react', async () => ({
  ...(await vi.importActual<typeof MotionReact>('motion/react')),
  useReducedMotion: () => motion.isReduced,
}));

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
  hasLogo: false,
  seriesId: null,
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

afterEach(() => {
  motion.isReduced = false;
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

  it('offers a season it does not hold at all, alongside the ones it does', async () => {
    fetchShowMock.mockResolvedValue(
      detail([
        { seasonNumber: 1, episodes: [1] },
        { seasonNumber: 3, episodes: [1] },
      ]),
    );
    render(<ShowDialog show={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(await screen.findByRole('button', { name: 'Season 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Season 1' })).toBeInTheDocument();
  });

  it('opens a season it holds none of, and says so of every episode', async () => {
    const user = userEvent.setup();
    fetchShowMock.mockResolvedValue({
      ...detail([{ seasonNumber: 1, episodes: [1] }]),
      shape: [
        { seasonNumber: 1, episodeCount: 1, episodes: [] },
        {
          seasonNumber: 2,
          episodeCount: 2,
          episodes: [
            { episodeNumber: 1, title: 'A Fresh Start', stillUrl: null, overview: null },
            { episodeNumber: 2, title: 'The Second', stillUrl: null, overview: null },
          ],
        },
      ],
    });
    render(<ShowDialog show={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Season 2' }));

    expect(screen.getByText('A Fresh Start')).toBeInTheDocument();
    expect(screen.getByText('The Second')).toBeInTheDocument();
    expect(screen.getAllByText('Not in this library')).toHaveLength(2);
  });

  it('offers nothing to play in a season it holds none of', async () => {
    const user = userEvent.setup();
    fetchShowMock.mockResolvedValue({
      ...detail([{ seasonNumber: 1, episodes: [1] }]),
      shape: [
        { seasonNumber: 1, episodeCount: 1, episodes: [] },
        {
          seasonNumber: 2,
          episodeCount: 1,
          episodes: [{ episodeNumber: 1, title: 'A Fresh Start', stillUrl: null, overview: null }],
        },
      ],
    });
    render(<ShowDialog show={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Season 2' }));

    expect(screen.queryByRole('button', { name: /Play A Fresh Start/ })).not.toBeInTheDocument();
  });

  it('shows the episodes missing off the end when the catalogue says how many there are', async () => {
    fetchShowMock.mockResolvedValue({
      ...detail([{ seasonNumber: 1, episodes: [1, 2] }]),
      shape: [
        {
          seasonNumber: 1,
          episodeCount: 4,
          episodes: [
            { episodeNumber: 3, title: 'Someone Is Thinking', stillUrl: null, overview: null },
            { episodeNumber: 4, title: 'What Kind of Voice?', stillUrl: null, overview: null },
          ],
        },
      ],
    });
    render(<ShowDialog show={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    await screen.findByText('Someone Is Thinking');

    expect(screen.getByText('What Kind of Voice?')).toBeInTheDocument();
  });

  it('offers the specials a series has and this library does not', async () => {
    fetchShowMock.mockResolvedValue({
      ...detail([{ seasonNumber: 1, episodes: [1] }]),
      shape: [
        {
          seasonNumber: 0,
          episodeCount: 2,
          episodes: [
            { episodeNumber: 1, title: 'An OVA', stillUrl: null, overview: null },
            { episodeNumber: 2, title: 'A Short', stillUrl: null, overview: null },
          ],
        },
        { seasonNumber: 1, episodeCount: 1, episodes: [] },
      ],
    });
    render(<ShowDialog show={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(await screen.findByRole('button', { name: 'Specials' })).toBeInTheDocument();
  });

  it('says nothing is missing from a series the catalogue says is complete', async () => {
    fetchShowMock.mockResolvedValue({
      ...detail([{ seasonNumber: 1, episodes: [1, 2] }]),
      shape: [{ seasonNumber: 1, episodeCount: 2, episodes: [] }],
    });
    render(<ShowDialog show={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    await screen.findByRole('button', { name: /Play Episode 1/ });

    expect(screen.queryByText('Not in this library')).not.toBeInTheDocument();
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

describe('what the header says about a series', () => {
  it('counts episodes alone for a series of one season', async () => {
    fetchShowMock.mockResolvedValue(detail([{ seasonNumber: 1, episodes: [1, 2, 3] }]));
    render(<ShowDialog show={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(await screen.findByText('3 episodes')).toBeInTheDocument();
  });

  it('counts seasons as well once there is more than one', async () => {
    const across = { ...summary, seasonCount: 2, episodeCount: 6 };

    fetchShowMock.mockResolvedValue(
      detail([
        { seasonNumber: 1, episodes: [1, 2, 3] },
        { seasonNumber: 2, episodes: [1, 2, 3] },
      ]),
    );
    render(<ShowDialog show={across} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(await screen.findByText('2 seasons · 6 episodes')).toBeInTheDocument();
  });

  it('names what a series is filed under', async () => {
    const filed = { ...summary, genres: ['Animation', 'Romance'] };

    fetchShowMock.mockResolvedValue(detail([{ seasonNumber: 1, episodes: [1] }]));
    render(<ShowDialog show={filed} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(await screen.findByText('Animation')).toBeInTheDocument();
    expect(screen.getByText('Romance')).toBeInTheDocument();
  });

  it('names at most three of them, since a header is not a list', async () => {
    const many = {
      ...summary,
      genres: ['Animation', 'Romance', 'Drama', 'Comedy', 'Slice of life'],
    };

    fetchShowMock.mockResolvedValue(detail([{ seasonNumber: 1, episodes: [1] }]));
    render(<ShowDialog show={many} onClose={vi.fn()} onPlay={vi.fn()} />);

    await screen.findByText('Animation');

    expect(screen.queryByText('Comedy')).not.toBeInTheDocument();
  });

  it('says nothing about genres for a series carrying none', async () => {
    fetchShowMock.mockResolvedValue(detail([{ seasonNumber: 1, episodes: [1] }]));
    render(<ShowDialog show={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    await screen.findByText('3 episodes');

    expect(screen.queryByText('Animation')).not.toBeInTheDocument();
  });

  it('closes when asked', async () => {
    const onClose = vi.fn();
    const actor = userEvent.setup();

    fetchShowMock.mockResolvedValue(detail([{ seasonNumber: 1, episodes: [1] }]));
    render(<ShowDialog show={summary} onClose={onClose} onPlay={vi.fn()} />);

    await screen.findByText('3 episodes');
    await actor.click(screen.getByRole('button', { name: /Close/ }));

    expect(onClose).toHaveBeenCalled();
  });

  it('draws nothing at all without a series to draw', () => {
    const { container } = render(<ShowDialog show={null} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('draws a series without motion for somebody who asked for less', async () => {
    motion.isReduced = true;
    fetchShowMock.mockResolvedValue(detail([{ seasonNumber: 1, episodes: [1] }]));

    render(<ShowDialog show={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(await screen.findByText('3 episodes')).toBeInTheDocument();
  });
});
