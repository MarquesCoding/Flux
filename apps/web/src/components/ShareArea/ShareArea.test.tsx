import { screen } from '@testing-library/react';
import { renderInACache } from '@FluxWeb/testing/renderInACache';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareArea } from './ShareArea';
import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { ShareOutcome } from '@FluxWeb/sharing/fetchShares';

const openMock = vi.hoisted(() => vi.fn());

vi.mock('@FluxWeb/sharing/fetchShares', () => ({ openShare: openMock }));

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

const opened = (over: Partial<Parameters<typeof ShareArea>[0]> = {}) =>
  renderInACache(<ShareArea token="abc123" onPlay={vi.fn()} {...over} />);

const answers = (outcome: ShareOutcome) => {
  openMock.mockResolvedValue(outcome);
};

beforeEach(() => {
  openMock.mockReset();
  answers({ kind: 'opened', share: { kind: 'item', title: 'Arrival', items: [item()] } });
});

describe('what a guest is shown', () => {
  it('names what was shared with them', async () => {
    opened();

    expect(await screen.findByRole('heading', { name: 'Arrival' })).toBeInTheDocument();
  });

  it('says which server it came from', async () => {
    opened({ name: 'The Attic' });

    expect(await screen.findByText(/Shared with you on The Attic/)).toBeInTheDocument();
  });

  it('offers to play it', async () => {
    const onPlay = vi.fn();

    opened({ onPlay });

    await userEvent.click(await screen.findByRole('button', { name: 'Play' }));

    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ title: 'Arrival' }), 0);
  });

  it('picks up where they got to, for as long as the page lives', async () => {
    const onPlay = vi.fn();

    opened({ onPlay, resumeFor: () => 640 });

    await userEvent.click(await screen.findByRole('button', { name: /Resume from/ }));

    expect(onPlay).toHaveBeenCalledWith(expect.anything(), 640);
  });

  it('offers to play rather than to resume where nothing has been watched', async () => {
    opened({ resumeFor: () => null });

    expect(await screen.findByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resume from/ })).not.toBeInTheDocument();
  });

  it('says a link has ended the moment it is told, without asking again first', async () => {
    opened({ endedReason: 'This link was withdrawn.' });

    expect(
      await screen.findByRole('heading', { name: 'This link was withdrawn.' }),
    ).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
  });

  it('offers no way anywhere else', async () => {
    opened();

    await screen.findByRole('heading', { name: 'Arrival' });

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });
});

describe('a series that was shared', () => {
  beforeEach(() => {
    answers({
      kind: 'opened',
      share: {
        kind: 'series',
        title: 'The Bear',
        items: [
          item({
            id: 'b',
            title: 'Hands',
            seriesTitle: 'The Bear',
            seasonNumber: 1,
            episodeNumber: 2,
          }),
          item({
            id: 'a',
            title: 'System',
            seriesTitle: 'The Bear',
            seasonNumber: 1,
            episodeNumber: 1,
          }),
        ],
      },
    });
  });

  it('lists its episodes', async () => {
    opened();

    expect(await screen.findByRole('heading', { name: 'Episodes' })).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByText('Hands')).toBeInTheDocument();
  });

  it('offers the first episode rather than whichever came back first', async () => {
    const onPlay = vi.fn();

    opened({ onPlay });

    await userEvent.click(await screen.findByRole('button', { name: 'Play' }));

    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ title: 'System' }), 0);
  });

  it('plays the episode that was chosen', async () => {
    const onPlay = vi.fn();

    opened({ onPlay });

    await userEvent.click(await screen.findByText('Hands'));

    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ title: 'Hands' }), 0);
  });
});

describe('a link that no longer works', () => {
  it('says why, in words', async () => {
    answers({ kind: 'gone', reason: 'This link has expired.' });

    opened();

    expect(
      await screen.findByRole('heading', { name: 'This link has expired.' }),
    ).toBeInTheDocument();
  });

  it('says a withdrawn link was withdrawn', async () => {
    answers({ kind: 'gone', reason: 'This link was withdrawn.' });

    opened();

    expect(
      await screen.findByRole('heading', { name: 'This link was withdrawn.' }),
    ).toBeInTheDocument();
  });

  it('says something useful for a link that never existed', async () => {
    answers({ kind: 'unknown' });

    opened();

    expect(await screen.findByText(/does not work/)).toBeInTheDocument();
  });

  it('offers no way in, since a guest has no account to sign in to', async () => {
    answers({ kind: 'gone', reason: 'This link has expired.' });

    opened();

    await screen.findByRole('heading', { name: 'This link has expired.' });

    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });
});
