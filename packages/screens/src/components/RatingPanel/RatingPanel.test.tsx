import { screen, waitFor } from '@testing-library/react';
import { renderInAnAddress } from '@FluxScreens/testing/renderInAnAddress';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RatingPanel } from './RatingPanel';
import type { HouseholdRating } from '@FluxContracts/schemas/Rating';

const fetchHouseholdRating = vi.fn<() => Promise<HouseholdRating>>();

vi.mock('@FluxClient/library/fetchRatings', () => ({
  fetchHouseholdRating: () => fetchHouseholdRating(),
}));

const MEDIA_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';

beforeEach(() => {
  fetchHouseholdRating.mockReset().mockResolvedValue({ average: null, count: 0 });
});

describe('RatingPanel', () => {
  it('offers this viewer a row of stars to press', async () => {
    renderInAnAddress(
      <RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" stars={null} onRate={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByRole('radiogroup', { name: 'Arrival' })).toBeInTheDocument();
    });
  });

  it('reports the rating that was pressed', async () => {
    const onRate = vi.fn();

    renderInAnAddress(
      <RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" stars={null} onRate={onRate} />,
    );

    await userEvent.click(await screen.findByRole('radio', { name: 'Arrival: 4 of 5' }));

    expect(onRate).toHaveBeenCalledWith(4);
  });

  it('reports nothing when the star already given is pressed again', async () => {
    const onRate = vi.fn();

    renderInAnAddress(
      <RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" stars={4} onRate={onRate} />,
    );

    await userEvent.click(await screen.findByRole('radio', { name: 'Arrival: 4 of 5' }));

    expect(onRate).toHaveBeenCalledWith(null);
  });

  it('shows what the household gave it', async () => {
    fetchHouseholdRating.mockResolvedValue({ average: 4.5, count: 2 });

    renderInAnAddress(
      <RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" stars={5} onRate={vi.fn()} />,
    );

    expect(await screen.findByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('from 2 ratings')).toBeInTheDocument();
  });

  it('says one rating rather than 1 ratings', async () => {
    fetchHouseholdRating.mockResolvedValue({ average: 3, count: 1 });

    renderInAnAddress(
      <RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" stars={3} onRate={vi.fn()} />,
    );

    expect(await screen.findByText('from 1 rating')).toBeInTheDocument();
  });

  it('says nothing about the household where nobody has rated it', async () => {
    renderInAnAddress(
      <RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" stars={null} onRate={vi.fn()} />,
    );

    await waitFor(() => {
      expect(fetchHouseholdRating).toHaveBeenCalled();
    });
    expect(screen.queryByText(/rating/)).not.toBeInTheDocument();
  });

  it('asks once for a subject rather than again whenever this viewer changes theirs', async () => {
    fetchHouseholdRating.mockResolvedValue({ average: 4, count: 1 });

    const { rerender } = renderInAnAddress(
      <RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" stars={4} onRate={vi.fn()} />,
    );

    await waitFor(() => {
      expect(fetchHouseholdRating).toHaveBeenCalledTimes(1);
    });

    rerender(
      <RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" stars={2} onRate={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('4.0')).toBeInTheDocument();
    });

    expect(fetchHouseholdRating).toHaveBeenCalledTimes(1);
  });

  it('reads the figure for a different subject', async () => {
    fetchHouseholdRating.mockResolvedValue({ average: 4, count: 1 });

    const { rerender } = renderInAnAddress(
      <RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" stars={4} onRate={vi.fn()} />,
    );

    await waitFor(() => {
      expect(fetchHouseholdRating).toHaveBeenCalledTimes(1);
    });

    rerender(<RatingPanel subject={{ seriesId: 'ted' }} title="Ted" stars={4} onRate={vi.fn()} />);

    await waitFor(() => {
      expect(fetchHouseholdRating).toHaveBeenCalledTimes(2);
    });
  });

  it('draws the household row as a picture rather than a second control', async () => {
    fetchHouseholdRating.mockResolvedValue({ average: 4.5, count: 2 });

    renderInAnAddress(
      <RatingPanel subject={{ mediaId: MEDIA_ID }} title="Arrival" stars={5} onRate={vi.fn()} />,
    );

    expect(
      await screen.findByRole('img', { name: 'Arrival, household: 4.5 out of 5' }),
    ).toBeInTheDocument();
  });
});
