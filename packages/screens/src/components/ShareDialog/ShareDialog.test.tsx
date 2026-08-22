import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareDialog } from './ShareDialog';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';
import type { NewShare } from '@ValenceContracts/schemas/Share';

const createMock = vi.hoisted(() =>
  vi.fn<(asked: NewShare) => Promise<{ token: string } | null>>(),
);

vi.mock('@ValenceClient/sharing/fetchShares', () => ({
  createShare: createMock,
  shareAddress: (token: string, origin: string) => `${origin}/share/${token}`,
}));

const film: MediaSummary = {
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
};

const episode: MediaSummary = {
  ...film,
  id: 'ep-1',
  title: 'System',
  seriesId: '5d3e2c1b-0a9f-4e8d-9c7b-6a5f4e3d2c1b',
  seriesTitle: 'The Bear',
  seasonNumber: 1,
  episodeNumber: 1,
};

const draw = (media: MediaSummary = film) =>
  render(
    <ShareDialog
      subject={{ kind: 'item', media }}
      isOpen
      onClose={vi.fn()}
      origin="https://valence.example"
    />,
  );

const drawProgramme = () =>
  render(
    <ShareDialog
      subject={{ kind: 'series', seriesId: episode.seriesId ?? '', title: 'The Bear' }}
      isOpen
      onClose={vi.fn()}
      origin="https://valence.example"
    />,
  );

beforeEach(() => {
  createMock.mockReset().mockResolvedValue({ token: 'a-token' });
});

describe('handing out a link', () => {
  it('offers a way out that does not depend on knowing about the escape key', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ShareDialog
        subject={{ kind: 'item', media: film }}
        isOpen
        onClose={onClose}
        origin="http://localhost"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('names what is being shared', () => {
    draw();

    expect(screen.getByText('Share Arrival')).toBeInTheDocument();
  });

  it('says plainly what the link lets somebody do', () => {
    draw();

    expect(screen.getByText(/watch what you shared, and nothing else/)).toBeInTheDocument();
  });

  it('says a link can be withdrawn while somebody is watching', () => {
    draw();

    expect(screen.getByText(/while somebody is watching/)).toBeInTheDocument();
  });

  it('makes a link and shows it once', async () => {
    draw();

    await userEvent.click(screen.getByRole('button', { name: 'Make a link' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('https://valence.example/share/a-token')).toBeInTheDocument();
    });
    expect(screen.getByText(/only time it is shown/)).toBeInTheDocument();
  });

  it('shares one item by default', async () => {
    draw();

    await userEvent.click(screen.getByRole('button', { name: 'Make a link' }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalled();
    });

    expect(createMock.mock.calls[0]?.[0]?.kind).toBe('item');
  });

  it('sets an expiry from the span that was chosen', async () => {
    draw();

    await userEvent.click(screen.getByRole('button', { name: 'Make a link' }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalled();
    });

    const [asked] = createMock.mock.calls[0] ?? [];

    expect(typeof asked?.expiresAt).toBe('string');
  });

  it('says so when the server refuses', async () => {
    createMock.mockResolvedValue(null);

    draw();

    await userEvent.click(screen.getByRole('button', { name: 'Make a link' }));

    expect(await screen.findByText(/could not be shared/)).toBeInTheDocument();
  });
});

describe('sharing an episode', () => {
  it('offers the whole programme as well as the one episode', () => {
    draw(episode);

    expect(screen.getByText('What to share')).toBeInTheDocument();
  });

  it('offers nothing to choose when the programme itself is what is being shared', () => {
    drawProgramme();

    expect(screen.queryByRole('button', { name: 'What to share' })).not.toBeInTheDocument();
  });

  it('still says what is being shared, so nobody hands out a programme by inference', () => {
    drawProgramme();

    expect(screen.getByText('What to share')).toBeInTheDocument();
    expect(screen.getByText('The whole programme')).toBeInTheDocument();
  });

  it('names the programme rather than whichever episode stands for it', () => {
    drawProgramme();

    expect(screen.getByText('Share The Bear')).toBeInTheDocument();
  });

  it('shares the whole programme, without an episode being involved at all', async () => {
    const user = userEvent.setup();

    drawProgramme();

    await user.click(screen.getByRole('button', { name: 'Make a link' }));

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'series', seriesId: episode.seriesId }),
    );
  });

  it('offers no such choice for a film, which is one item either way', () => {
    draw();

    expect(screen.queryByText('What to share')).not.toBeInTheDocument();
  });

  it('shares the whole programme when that is what was chosen', async () => {
    draw(episode);

    await userEvent.click(screen.getByRole('button', { name: /What to share/ }));
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'The whole programme' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Make a link' }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalled();
    });

    expect(createMock.mock.calls[0]?.[0]?.kind).toBe('series');
  });

  it('copies the link somebody made, since it is shown only once', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('navigator', { ...window.navigator, clipboard: { writeText } });

    draw(episode);

    await userEvent.click(screen.getByRole('button', { name: 'Make a link' }));
    await screen.findByDisplayValue('https://valence.example/share/a-token');

    await userEvent.click(screen.getByRole('button', { name: /Copy/ }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('https://valence.example/share/a-token');
    });

    vi.unstubAllGlobals();
  });
});
