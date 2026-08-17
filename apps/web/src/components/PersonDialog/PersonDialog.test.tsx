import { screen, waitFor } from '@testing-library/react';
import { renderInACache } from '@FluxWeb/testing/renderInACache';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonDialog } from './PersonDialog';
import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { Person, PersonCredits } from '@FluxContracts/schemas/Person';

const personMock = vi.hoisted(() => vi.fn());
const creditsMock = vi.hoisted(() => vi.fn());

vi.mock('@FluxWeb/library/fetchPerson', () => ({
  fetchPerson: personMock,
  fetchPersonCredits: creditsMock,
}));

vi.mock('@FluxWeb/components/RailCard/RailCard', () => ({
  RailCard: ({ media }: { media: MediaSummary }) => <span>{media.title}</span>,
}));

const NOTHING: PersonCredits = { films: [], shows: [], episodes: [] };

const SOMEBODY: Person = {
  id: 1245,
  name: 'Amy Adams',
  portraitUrl: null,
  biography: null,
  bornOn: null,
  bornIn: null,
};

const item = (over: Partial<MediaSummary> = {}): MediaSummary => ({
  id: '9c858901-8a57-4791-81fe-4c455b099bc9',
  libraryId: '2b6f0cc9-04f0-4f26-9f1a-1d5b2ea92d9f',
  title: 'Arrival',
  year: 2016,
  durationSeconds: 7200,
  width: 1920,
  height: 1080,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: true,
  hasBackdrop: true,
  hasLogo: false,
  seriesId: null,
  seriesTitle: null,
  seasonNumber: null,
  episodeNumber: null,
  rating: null,
  genres: [],
  ...over,
});

const draw = (over: Partial<Parameters<typeof PersonDialog>[0]> = {}) =>
  renderInACache(
    <PersonDialog
      personId={1245}
      onClose={vi.fn()}
      onPlay={vi.fn()}
      onInspect={vi.fn()}
      {...over}
    />,
  );

beforeEach(() => {
  personMock.mockReset().mockResolvedValue(SOMEBODY);
  creditsMock.mockReset().mockResolvedValue(NOTHING);
});

describe('PersonDialog', () => {
  it('opens nothing while nobody is named', () => {
    draw({ personId: null });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('says who somebody is', async () => {
    draw();

    expect(await screen.findByRole('heading', { name: 'Amy Adams' })).toBeInTheDocument();
  });

  it('says the part they played in what it was opened from', async () => {
    draw({ role: 'Louise Banks' });

    expect(await screen.findByText('as Louise Banks')).toBeInTheDocument();
  });

  it('says nothing about a part when it was not opened from one', async () => {
    draw();

    await screen.findByRole('heading', { name: 'Amy Adams' });
    expect(screen.queryByText(/^as /)).not.toBeInTheDocument();
  });

  it('writes a birth date the way somebody says it', async () => {
    personMock.mockResolvedValue({ ...SOMEBODY, bornOn: '1974-08-20', bornIn: 'Vicenza' });

    draw();

    expect(await screen.findByText(/Vicenza/)).toBeInTheDocument();
    expect(screen.getByText(/1974/)).toBeInTheDocument();
  });

  it('leaves out a birth date the catalogue wrote unreadably', async () => {
    personMock.mockResolvedValue({ ...SOMEBODY, bornOn: 'the seventies', bornIn: null });

    draw();

    await screen.findByRole('heading', { name: 'Amy Adams' });
    expect(screen.queryByText(/seventies/)).not.toBeInTheDocument();
  });

  it('shows the films of theirs this server holds', async () => {
    creditsMock.mockResolvedValue({ ...NOTHING, films: [item()] });

    draw();

    expect(await screen.findByText('Arrival')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Films' })).toBeInTheDocument();
  });

  it('shows programmes and episodes under headings of their own', async () => {
    creditsMock.mockResolvedValue({
      films: [],
      shows: [item({ id: 'a', title: 'System', seriesTitle: 'The Bear' })],
      episodes: [item({ id: 'b', title: 'System', seriesTitle: 'The Bear' })],
    });

    draw();

    expect(await screen.findByRole('heading', { name: 'Programmes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Episodes' })).toBeInTheDocument();
  });

  it('draws no heading for a kind this server holds none of', async () => {
    creditsMock.mockResolvedValue({ ...NOTHING, films: [item()] });

    draw();

    await screen.findByText('Arrival');
    expect(screen.queryByRole('heading', { name: 'Programmes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Episodes' })).not.toBeInTheDocument();
  });

  it('says plainly when there is nothing to say and nothing to show', async () => {
    personMock.mockResolvedValue(null);

    draw();

    expect(
      await screen.findByText(
        'Nothing is known about them, and nothing of theirs is on this server.',
      ),
    ).toBeInTheDocument();
  });

  it('says nothing of the sort once there is something of theirs here', async () => {
    personMock.mockResolvedValue(null);
    creditsMock.mockResolvedValue({ ...NOTHING, films: [item()] });

    draw();

    await screen.findByText('Arrival');
    expect(screen.queryByText(/Nothing is known about them/)).not.toBeInTheDocument();
  });

  it('reads about whoever it was opened for', async () => {
    draw({ personId: 4495 });

    await waitFor(() => {
      expect(personMock).toHaveBeenCalledWith(4495);
    });
    expect(creditsMock).toHaveBeenCalledWith(4495);
  });

  it('can be dismissed', async () => {
    const onClose = vi.fn();

    draw({ onClose });

    await userEvent.click(await screen.findByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
