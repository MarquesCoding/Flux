import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchPicker } from './MatchPicker';
import type { MediaSummary } from '@FluxContracts/schemas/Library';

const searchCatalogueMock = vi.hoisted(() => vi.fn());
const correctMatchMock = vi.hoisted(() => vi.fn());
const forgetCorrectionMock = vi.hoisted(() => vi.fn());

vi.mock('@FluxWeb/admin/fetchAdmin', () => ({ searchCatalogue: searchCatalogueMock }));
vi.mock('@FluxWeb/library/fetchLibrary', () => ({
  correctMatch: correctMatchMock,
  forgetCorrection: forgetCorrectionMock,
}));

const episode: MediaSummary = {
  id: '9c858901-8a57-4791-81fe-4c455b099bc9',
  libraryId: '11111111-1111-4111-8111-111111111111',
  title: "Long Day's Journey Into Night",
  year: 2022,
  durationSeconds: 3000,
  width: 1920,
  height: 1080,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: false,
  hasBackdrop: false,
  hasLogo: false,
  seriesId: null,
  seriesTitle: 'From',
  seasonNumber: 1,
  episodeNumber: 1,
};

const film: MediaSummary = { ...episode, id: 'film-1', title: 'Parasite', seriesTitle: null };

const MATCH = {
  externalId: '110447',
  kind: 'tv' as const,
  title: 'From',
  year: 2022,
  overview: 'A town traps everyone who enters.',
  posterUrl: 'https://image.tmdb.org/from.jpg',
};

beforeEach(() => {
  searchCatalogueMock.mockReset();
  correctMatchMock.mockReset();
  forgetCorrectionMock.mockReset();
  forgetCorrectionMock.mockResolvedValue({ corrected: 10, jobId: 'job-2' });
  searchCatalogueMock.mockResolvedValue([MATCH]);
  correctMatchMock.mockResolvedValue({ corrected: 10, jobId: 'job-1' });
});

describe('MatchPicker', () => {
  it('opens with the name already filled in, since that is what was matched wrongly', () => {
    render(<MatchPicker media={episode} onClose={vi.fn()} onCorrected={vi.fn()} />);

    expect(screen.getByLabelText('Search for a series')).toHaveValue('From');
  });

  it('searches the catalogue by name, not by id', async () => {
    const user = userEvent.setup();
    render(<MatchPicker media={episode} onClose={vi.fn()} onCorrected={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(searchCatalogueMock).toHaveBeenCalledWith('From', 'tv');
  });

  it('looks for a film when the item is one', async () => {
    const user = userEvent.setup();
    render(<MatchPicker media={film} onClose={vi.fn()} onCorrected={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(searchCatalogueMock).toHaveBeenCalledWith('Parasite', 'movie');
  });

  it('shows what came back, with the year that tells two of a name apart', async () => {
    const user = userEvent.setup();
    render(<MatchPicker media={episode} onClose={vi.fn()} onCorrected={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('From (2022)')).toBeInTheDocument();
  });

  it('corrects the item to whichever was chosen', async () => {
    const user = userEvent.setup();
    render(<MatchPicker media={episode} onClose={vi.fn()} onCorrected={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByRole('button', { name: /From \(2022\)/ }));

    expect(correctMatchMock).toHaveBeenCalledWith(episode.id, '110447', 'tv');
  });

  it('closes and tells the page once the correction lands', async () => {
    const onClose = vi.fn();
    const onCorrected = vi.fn();
    const user = userEvent.setup();
    render(<MatchPicker media={episode} onClose={onClose} onCorrected={onCorrected} />);

    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByRole('button', { name: /From \(2022\)/ }));

    await waitFor(() => {
      expect(onCorrected).toHaveBeenCalled();
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('says when nothing came back rather than looking like it is still thinking', async () => {
    searchCatalogueMock.mockResolvedValue([]);

    const user = userEvent.setup();
    render(<MatchPicker media={episode} onClose={vi.fn()} onCorrected={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText(/Nothing came back/)).toBeInTheDocument();
  });

  it('shows why a correction failed, and stays open so it can be tried again', async () => {
    correctMatchMock.mockResolvedValue({ problem: 'That is for administrators.' });

    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<MatchPicker media={episode} onClose={onClose} onCorrected={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByRole('button', { name: /From \(2022\)/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('administrators');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('puts an item back under the catalogue, for a correction that turned out wrong', async () => {
    const user = userEvent.setup();
    render(<MatchPicker media={episode} onClose={vi.fn()} onCorrected={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Forget the correction/ }));

    expect(forgetCorrectionMock).toHaveBeenCalledWith(episode.id);
  });

  it('closes and tells the page once the correction is forgotten', async () => {
    const onClose = vi.fn();
    const onCorrected = vi.fn();
    const user = userEvent.setup();
    render(<MatchPicker media={episode} onClose={onClose} onCorrected={onCorrected} />);

    await user.click(screen.getByRole('button', { name: /Forget the correction/ }));

    await waitFor(() => {
      expect(onCorrected).toHaveBeenCalled();
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('stays open and says so when it could not be put back', async () => {
    forgetCorrectionMock.mockResolvedValue(null);

    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<MatchPicker media={episode} onClose={onClose} onCorrected={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Forget the correction/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be put back');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not need a search before it will put something back', async () => {
    const user = userEvent.setup();
    render(<MatchPicker media={episode} onClose={vi.fn()} onCorrected={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Forget the correction/ }));

    expect(searchCatalogueMock).not.toHaveBeenCalled();
  });

  it('hands back the job reading the files, so it can be watched', async () => {
    const onCorrected = vi.fn();
    const user = userEvent.setup();
    render(<MatchPicker media={episode} onClose={vi.fn()} onCorrected={onCorrected} />);

    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByRole('button', { name: /From \(2022\)/ }));

    await waitFor(() => {
      expect(onCorrected).toHaveBeenCalledWith('job-1');
    });
  });

  it('says a correction reaches the whole series', () => {
    render(<MatchPicker media={episode} onClose={vi.fn()} onCorrected={vi.fn()} />);

    expect(screen.getByText(/every episode of this series/)).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(MatchPicker.displayName).toBe('MatchPicker');
  });
});
