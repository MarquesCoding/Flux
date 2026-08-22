import { screen, waitFor } from '@testing-library/react';
import { renderInAnAddress } from '@ValenceScreens/testing/renderInAnAddress';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryPanel } from './HistoryPanel';
import type { Viewing } from '@ValenceContracts/schemas/Viewing';

const { fetchMock, forgetOneMock, forgetAllMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  forgetOneMock: vi.fn(),
  forgetAllMock: vi.fn(),
}));

vi.mock('@ValenceClient/history/fetchHistory', () => ({
  fetchHistory: fetchMock,
  forgetViewing: forgetOneMock,
  forgetHistory: forgetAllMock,
  A_PAGE: 30,
}));

const NOW = new Date('2026-08-14T12:00:00.000Z');

const viewing = (overrides: Partial<Viewing> = {}): Viewing => ({
  id: 'viewing-1',
  mediaItemId: 'media-1',
  title: 'Arrival',
  seriesTitle: null,
  startedAt: '2026-08-14T09:00:00.000Z',
  lastWatchedAt: '2026-08-14T11:00:00.000Z',
  secondsWatched: 7_200,
  isFinished: false,
  ...overrides,
});

const aFullPage = [...Array.from({ length: 30 }).keys()].map((index) =>
  viewing({ id: `viewing-${index.toString()}`, title: `Film ${index.toString()}` }),
);

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue([viewing()]);
  forgetOneMock.mockReset().mockResolvedValue(true);
  forgetAllMock.mockReset().mockResolvedValue(1);
});

describe('a viewer’s history', () => {
  it('lists what was watched', async () => {
    renderInAnAddress(<HistoryPanel now={NOW} />);

    expect(await screen.findByText('Arrival')).toBeInTheDocument();
  });

  it('says when it was watched in words', async () => {
    renderInAnAddress(<HistoryPanel now={NOW} />);

    expect(await screen.findByText(/An hour ago/)).toBeInTheDocument();
  });

  it('says how long was actually spent, not how long the thing is', async () => {
    renderInAnAddress(<HistoryPanel now={NOW} />);

    expect(await screen.findByText(/watched/)).toBeInTheDocument();
  });

  it('names the series an episode belongs to', async () => {
    fetchMock.mockResolvedValue([viewing({ title: 'Episode 1', seriesTitle: 'Yamada-kun' })]);

    renderInAnAddress(<HistoryPanel now={NOW} />);

    expect(await screen.findByText(/Yamada-kun/)).toBeInTheDocument();
  });

  it('marks something finished, since that is the question being asked of it', async () => {
    fetchMock.mockResolvedValue([viewing({ isFinished: true })]);

    renderInAnAddress(<HistoryPanel now={NOW} />);

    expect(await screen.findByText('Finished')).toBeInTheDocument();
  });

  it('still shows a viewing whose item has left the library', async () => {
    fetchMock.mockResolvedValue([viewing({ title: null })]);

    renderInAnAddress(<HistoryPanel now={NOW} />);

    expect(await screen.findByText('No longer in the library')).toBeInTheDocument();
  });

  it('says so plainly when nothing has been watched', async () => {
    fetchMock.mockResolvedValue([]);

    renderInAnAddress(<HistoryPanel now={NOW} />);

    expect(await screen.findByText(/Nothing yet/)).toBeInTheDocument();
  });

  it('lets a viewer forget one thing', async () => {
    renderInAnAddress(<HistoryPanel now={NOW} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Forget Arrival' }));

    expect(forgetOneMock).toHaveBeenCalledWith('viewing-1');

    await waitFor(() => {
      expect(screen.queryByText('Arrival')).not.toBeInTheDocument();
    });
  });

  it('puts a row back when the server would not forget it', async () => {
    forgetOneMock.mockResolvedValue(false);

    renderInAnAddress(<HistoryPanel now={NOW} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Forget Arrival' }));

    expect(await screen.findByText('Arrival')).toBeInTheDocument();
  });

  it('lets a viewer forget the lot', async () => {
    forgetAllMock.mockImplementation(() => {
      fetchMock.mockResolvedValue([]);

      return Promise.resolve(true);
    });

    renderInAnAddress(<HistoryPanel now={NOW} />);

    await screen.findByText('Arrival');

    await userEvent.click(screen.getByRole('button', { name: /Forget everything/ }));

    expect(forgetAllMock).toHaveBeenCalled();
    expect(await screen.findByText(/Nothing yet/)).toBeInTheDocument();
  });

  it('offers more only when a full page came back', async () => {
    renderInAnAddress(<HistoryPanel now={NOW} />);

    await screen.findByText('Arrival');

    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  });

  it('asks for the next page from where the last one ended', async () => {
    fetchMock.mockResolvedValueOnce(aFullPage).mockResolvedValueOnce([viewing({ id: 'later' })]);

    renderInAnAddress(<HistoryPanel now={NOW} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Show more' }));

    expect(fetchMock).toHaveBeenLastCalledWith(30);
  });

  it('stops offering more once a short page comes back', async () => {
    fetchMock.mockResolvedValueOnce(aFullPage).mockResolvedValueOnce([viewing({ id: 'later' })]);

    renderInAnAddress(<HistoryPanel now={NOW} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Show more' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
    });
  });

  it('says viewings are forgotten eventually, where somebody will read it', async () => {
    renderInAnAddress(<HistoryPanel now={NOW} />);

    expect(await screen.findByText(/forgotten automatically after a year/)).toBeInTheDocument();
  });
});
