import { screen, waitFor } from '@testing-library/react';
import { renderInAShell } from '@ValenceScreens/testing/renderInAShell';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RatingPanel } from './RatingPanel';
import type { HouseholdRating, Rating } from '@ValenceContracts/schemas/Rating';

const fetchHouseholdRating = vi.fn<() => Promise<HouseholdRating>>();

const fetchRatings = vi.fn<() => Promise<Rating[]>>();

vi.mock('@ValenceClient/library/fetchRatings', () => ({
  fetchHouseholdRating: () => fetchHouseholdRating(),
  fetchRatings: () => fetchRatings(),
  setRating: () => Promise.resolve(true),
}));

const MEDIA_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';

const TED_ID = '22222222-2222-4222-8222-222222222222';

const givenStars = (stars: number): Rating[] => [
  { mediaId: MEDIA_ID, seriesId: null, stars, ratedAt: '2026-01-01T00:00:00.000Z' },
];

beforeEach(() => {
  fetchHouseholdRating.mockReset().mockResolvedValue({ average: null, count: 0 });
  fetchRatings.mockReset().mockResolvedValue([]);
});

describe('RatingPanel', () => {
  it('offers this viewer a row of stars to press', async () => {
    renderInAShell(
      <RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" onRate={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByRole('radiogroup', { name: 'Arrival' })).toBeInTheDocument();
    });
  });

  it('reads the star this viewer already gave rather than being handed one', async () => {
    fetchRatings.mockResolvedValue(givenStars(4));

    renderInAShell(
      <RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" onRate={vi.fn()} />,
    );

    expect(
      await screen.findByRole('radio', { name: 'Arrival: 4 of 5', checked: true }),
    ).toBeInTheDocument();
  });

  it('pays no attention to a star given to something else', async () => {
    fetchRatings.mockResolvedValue([
      {
        mediaId: '11111111-1111-4111-8111-111111111111',
        seriesId: null,
        stars: 5,
        ratedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    renderInAShell(
      <RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" onRate={vi.fn()} />,
    );

    await waitFor(() => {
      expect(fetchRatings).toHaveBeenCalled();
    });

    expect(
      screen.queryByRole('radio', { name: 'Arrival: 5 of 5', checked: true }),
    ).not.toBeInTheDocument();
  });

  it('reports the rating that was pressed', async () => {
    const onRate = vi.fn();

    renderInAShell(<RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" onRate={onRate} />);

    await userEvent.click(await screen.findByRole('radio', { name: 'Arrival: 4 of 5' }));

    expect(onRate).toHaveBeenCalledWith(4);
  });

  it('reports nothing when the star already given is pressed again', async () => {
    fetchRatings.mockResolvedValue(givenStars(4));

    const onRate = vi.fn();

    renderInAShell(<RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" onRate={onRate} />);

    await userEvent.click(await screen.findByRole('radio', { name: 'Arrival: 4 of 5' }));

    expect(onRate).toHaveBeenCalledWith(null);
  });

  it('shows what the household gave it', async () => {
    fetchHouseholdRating.mockResolvedValue({ average: 4.5, count: 2 });

    renderInAShell(
      <RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" onRate={vi.fn()} />,
    );

    expect(await screen.findByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('from 2 ratings')).toBeInTheDocument();
  });

  it('says one rating rather than 1 ratings', async () => {
    fetchHouseholdRating.mockResolvedValue({ average: 3, count: 1 });

    renderInAShell(
      <RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" onRate={vi.fn()} />,
    );

    expect(await screen.findByText('from 1 rating')).toBeInTheDocument();
  });

  it('says nothing about the household where nobody has rated it', async () => {
    renderInAShell(
      <RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" onRate={vi.fn()} />,
    );

    await waitFor(() => {
      expect(fetchHouseholdRating).toHaveBeenCalled();
    });

    expect(screen.queryByText(/rating/)).not.toBeInTheDocument();
  });

  it('asks once for a subject, however many panels are showing it', async () => {
    fetchHouseholdRating.mockResolvedValue({ average: 4, count: 1 });

    renderInAShell(
      <>
        <RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" onRate={vi.fn()} />
        <RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" onRate={vi.fn()} />
      </>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('4.0')).toHaveLength(2);
    });

    expect(fetchHouseholdRating).toHaveBeenCalledTimes(1);
  });

  it('reads the figure for a different subject', async () => {
    fetchHouseholdRating.mockResolvedValue({ average: 4, count: 1 });

    renderInAShell(
      <>
        <RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" onRate={vi.fn()} />
        <RatingPanel subject={{ seriesId: TED_ID }} title="Ted" onRate={vi.fn()} />
      </>,
    );

    await waitFor(() => {
      expect(fetchHouseholdRating).toHaveBeenCalledTimes(2);
    });
  });

  it('draws the household row as a picture rather than a second control', async () => {
    fetchHouseholdRating.mockResolvedValue({ average: 4.5, count: 2 });

    renderInAShell(
      <RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" onRate={vi.fn()} />,
    );

    expect(
      await screen.findByRole('img', { name: 'Arrival, household: 4.5 out of 5' }),
    ).toBeInTheDocument();
  });
});
