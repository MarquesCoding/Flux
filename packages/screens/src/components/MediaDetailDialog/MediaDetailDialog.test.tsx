import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderInAnAddress } from '@ValenceScreens/testing/renderInAnAddress';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaDetailDialog } from './MediaDetailDialog';
import type { ReactNode } from 'react';
import type { MediaDetail, MediaSummary } from '@ValenceContracts/schemas/Library';
import { installPlatform } from '@ValenceClient/platform/installPlatform';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';
import type * as MotionReact from 'motion/react';

const motion = vi.hoisted(() => ({ isReduced: false }));

vi.mock('motion/react', async () => ({
  ...(await vi.importActual<typeof MotionReact>('motion/react')),
  useReducedMotion: () => motion.isReduced,
  useReducedMotionConfig: () => motion.isReduced,
}));

const detailMock = vi.hoisted(() => vi.fn());

vi.mock('@ValenceClient/library/fetchLibrary', () => ({
  fetchMediaDetail: detailMock,
}));

const downloadsMock = vi.hoisted(() => vi.fn());

vi.mock('@ValenceClient/downloads/fetchDownloads', () => ({
  fetchDownloads: downloadsMock,
  fetchHoldings: vi.fn(() => Promise.resolve([])),
}));

const preview = vi.hoisted(() => ({
  report: (isPlaying: boolean) => {
    void isPlaying;
  },
}));

vi.mock('@ValenceScreens/components/MediaPreview/MediaPreview', () => ({
  MediaPreview: ({
    actions,
    onPlayingChange,
  }: {
    actions?: ReactNode;
    onPlayingChange?: (isPlaying: boolean) => void;
  }) => {
    preview.report = (isPlaying) => {
      onPlayingChange?.(isPlaying);
    };

    return (
      <div>
        preview
        {actions}
      </div>
    );
  },
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
  hasLogo: false,
  seriesId: null,
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
  videoBitDepth: 8,
  canCopySegments: true,
  videoIsInterlaced: false,
  width: 1920,
  height: 1080,
  bitrateKbps: 12000,
  audioStreams: [],
  subtitleStreams: [],
  addedAt: '2026-08-10T00:00:00.000Z',
  metadata: { hasPoster: true, hasBackdrop: true, hasLogo: false, ...overrides },
});

beforeEach(() => {
  detailMock.mockReset();
  detailMock.mockResolvedValue(detail());
  downloadsMock.mockReset();
  downloadsMock.mockResolvedValue([]);
});

afterEach(() => {
  motion.isReduced = false;
});

describe('MediaDetailDialog', () => {
  it('shows nothing when nothing was chosen', () => {
    renderInAnAddress(<MediaDetailDialog media={null} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers to download on a client that can keep a file', () => {
    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Download/ })).toBeInTheDocument();
  });

  it('offers no download in a browser, which cannot be trusted to keep one', () => {
    installPlatform(aFakePlatform({ canKeepFiles: () => false }));

    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /Download/ })).not.toBeInTheDocument();
  });

  it('draws while one of this viewer’s downloads is still being prepared', async () => {
    downloadsMock.mockResolvedValue([
      {
        id: 'download-1',
        mediaId: summary.id,
        seriesId: null,
        seriesTitle: null,
        title: 'Arrival',
        quality: 'original',
        audioLanguages: [],
        state: 'preparing',
        progress: 0.4,
        bytesPerSecond: null,
        sizeBytes: null,
        failure: null,
        askedAt: '2026-08-10T00:00:00.000Z',
        readyAt: null,
      },
    ]);

    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(await screen.findByRole('button', { name: /Preparing 40%/ })).toBeInTheDocument();
  });

  it('names itself after the item', () => {
    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Arrival' })).toBeInTheDocument();
  });

  it('offers to play in the same bright button as everywhere, as wide as the actions beside it', () => {
    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Play' })).toHaveClass('flex-1', 'bg-white');
  });

  it('asks for the full-size lettering, so a logo is not stretched soft across the artwork', () => {
    renderInAnAddress(
      <MediaDetailDialog
        media={{ ...summary, hasLogo: true }}
        onClose={vi.fn()}
        onPlay={vi.fn()}
      />,
    );

    expect(document.querySelector('img[src*="/image/logo"]')).toHaveAttribute(
      'src',
      `/api/media/${summary.id}/image/logo?at=full`,
    );
  });

  it('shows what is known before any details arrive', () => {
    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument();
    expect(screen.getByText('2016')).toBeInTheDocument();
    expect(screen.getByText('2:00:00')).toBeInTheDocument();
  });

  it('shows the overview once it arrives', async () => {
    detailMock.mockResolvedValue(detail({ overview: 'A linguist meets visitors.' }));
    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(await screen.findByText('A linguist meets visitors.')).toBeInTheDocument();
  });

  it('names the cast with their roles', async () => {
    detailMock.mockResolvedValue(
      detail({
        cast: [{ personId: null, name: 'Amy Adams', role: 'Louise Banks', imageUrl: null }],
      }),
    );
    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(await screen.findByText('Amy Adams')).toBeInTheDocument();
    expect(screen.getByText('Louise Banks')).toBeInTheDocument();
  });

  it('says why the cast is empty rather than leaving a blank space', async () => {
    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    await waitFor(() => {
      expect(detailMock).toHaveBeenCalled();
    });

    expect(screen.getByRole('heading', { name: 'Cast' })).toBeInTheDocument();
    expect(await screen.findByText(/metadata provider supplies the cast/)).toBeInTheDocument();
  });

  it('says why there is no synopsis rather than showing an empty paragraph', async () => {
    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(await screen.findByText(/Configure a metadata provider/)).toBeInTheDocument();
  });

  it('holds the shape of what is coming while it loads', () => {
    detailMock.mockReturnValue(new Promise(() => undefined));
    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('says which episode this is when it is one', async () => {
    detailMock.mockResolvedValue(detail({ seasonNumber: 2, episodeNumber: 5 }));
    renderInAnAddress(
      <MediaDetailDialog
        media={{ ...summary, seriesTitle: 'Story of Us', seasonNumber: 2, episodeNumber: 5 }}
        onClose={vi.fn()}
        onPlay={vi.fn()}
      />,
    );

    expect(await screen.findByText('EP5')).toBeInTheDocument();
    expect(screen.getByText('S2')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Story of Us' })).toBeInTheDocument();
  });

  it('offers the rest of the season', async () => {
    detailMock.mockResolvedValue(detail({ seasonNumber: 2, episodeNumber: 5 }));
    renderInAnAddress(
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

    renderInAnAddress(
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
    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={onPlay} />);

    await user.click(screen.getByRole('button', { name: 'Play' }));

    expect(onPlay).toHaveBeenCalledWith(summary, 0);
  });

  it('closes on request', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderInAnAddress(<MediaDetailDialog media={summary} onClose={onClose} onPlay={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('remains readable when the details cannot be loaded at all', async () => {
    detailMock.mockResolvedValue(null);
    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

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

describe('keeping something, and getting back to where you were', () => {
  it('offers to keep an item that is not kept', async () => {
    const onToggleKept = vi.fn();
    const actor = userEvent.setup();

    renderInAnAddress(
      <MediaDetailDialog
        media={summary}
        onClose={vi.fn()}
        onPlay={vi.fn()}
        isKept={false}
        onToggleKept={onToggleKept}
      />,
    );

    await actor.click(await screen.findByRole('button', { name: 'Keep Arrival' }));

    expect(onToggleKept).toHaveBeenCalledWith(summary);
  });

  it('offers to stop keeping one that is', async () => {
    renderInAnAddress(
      <MediaDetailDialog
        media={summary}
        onClose={vi.fn()}
        onPlay={vi.fn()}
        isKept
        onToggleKept={vi.fn()}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Stop keeping Arrival' })).toBeInTheDocument();
  });

  it('offers nothing to keep with when nobody is listening', () => {
    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /Keep Arrival/ })).not.toBeInTheDocument();
  });

  it('offers the way back it was given, by the name it was given', async () => {
    const onBack = vi.fn();
    const actor = userEvent.setup();

    renderInAnAddress(
      <MediaDetailDialog
        media={summary}
        onClose={vi.fn()}
        onPlay={vi.fn()}
        onBack={onBack}
        backLabel="Back to the series"
      />,
    );

    await actor.click(await screen.findByRole('button', { name: 'Back to the series' }));

    expect(onBack).toHaveBeenCalled();
  });

  it('calls the way back simply Back when it was not named', async () => {
    renderInAnAddress(
      <MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} onBack={vi.fn()} />,
    );

    expect(await screen.findByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('offers no way back when there is nowhere to go', () => {
    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });

  it('names what an item is filed under once the details arrive', async () => {
    detailMock.mockResolvedValue(detail({ genres: ['Science fiction', 'Drama'] }));

    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(await screen.findByText('Science fiction')).toBeInTheDocument();
  });

  it('says nothing about genres for an item carrying none', async () => {
    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    await waitFor(() => {
      expect(detailMock).toHaveBeenCalled();
    });

    expect(screen.queryByText('Science fiction')).not.toBeInTheDocument();
  });

  it('offers the rest of a season, and opens the one that is chosen', async () => {
    const onSelectSibling = vi.fn();
    const actor = userEvent.setup();
    const sibling: MediaSummary = {
      ...summary,
      id: 'media-2',
      title: 'Episode 2',
      seriesTitle: 'A Sign of Affection',
      seasonNumber: 1,
      episodeNumber: 2,
    };

    renderInAnAddress(
      <MediaDetailDialog
        media={summary}
        onClose={vi.fn()}
        onPlay={vi.fn()}
        siblings={[sibling]}
        onSelectSibling={onSelectSibling}
      />,
    );

    await actor.click(await screen.findByRole('button', { name: /Episode 2/ }));

    expect(onSelectSibling).toHaveBeenCalledWith(sibling);
  });

  it('draws an item without motion for somebody who asked for less', () => {
    motion.isReduced = true;

    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Arrival' })).toBeInTheDocument();
  });

  it('describes the next thing opened rather than showing it the last one’s skeletons', async () => {
    detailMock.mockReturnValue(new Promise(() => undefined));

    const view = renderInAnAddress(
      <MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />,
    );

    view.rerender(<MediaDetailDialog media={null} onClose={vi.fn()} onPlay={vi.fn()} />);

    detailMock.mockResolvedValue(detail({ overview: 'Spice must flow.' }));

    view.rerender(
      <MediaDetailDialog
        media={{ ...summary, id: 'media-2', title: 'Dune' }}
        onClose={vi.fn()}
        onPlay={vi.fn()}
      />,
    );

    expect(await screen.findByText('Spice must flow.')).toBeInTheDocument();
  });
});

describe('opening one item after another', () => {
  const header = () => document.querySelector('.transition-opacity.duration-700');

  const logo = () => document.querySelector('img[src*="/image/logo"]');

  it('shows the next item’s title rather than opening it already faded out', async () => {
    detailMock.mockResolvedValue(detail());

    const view = renderInAnAddress(
      <MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />,
    );

    expect(header()?.className).toContain('opacity-100');

    act(() => {
      preview.report(true);
    });

    await waitFor(() => {
      expect(header()?.className).toContain('opacity-0');
    });

    view.rerender(<MediaDetailDialog media={null} onClose={vi.fn()} onPlay={vi.fn()} />);
    view.rerender(
      <MediaDetailDialog
        media={{ ...summary, id: 'media-2', title: 'Dune' }}
        onClose={vi.fn()}
        onPlay={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(header()?.className).toContain('opacity-100');
    });
    expect(screen.getByRole('heading', { name: 'Dune' })).toBeInTheDocument();
  });

  it('tries an item’s lettering again the next time it is opened', async () => {
    detailMock.mockResolvedValue(detail());

    const lettered = { ...summary, hasLogo: true };
    const view = renderInAnAddress(
      <MediaDetailDialog media={lettered} onClose={vi.fn()} onPlay={vi.fn()} />,
    );

    const shown = logo();

    if (shown === null) {
      throw new Error('The dialog drew no lettering to fail.');
    }

    fireEvent.error(shown);

    await waitFor(() => {
      expect(logo()).toBeNull();
    });

    view.rerender(<MediaDetailDialog media={null} onClose={vi.fn()} onPlay={vi.fn()} />);
    view.rerender(<MediaDetailDialog media={lettered} onClose={vi.fn()} onPlay={vi.fn()} />);

    await waitFor(() => {
      expect(logo()).not.toBeNull();
    });
  });
});

describe('the extras a film carries', () => {
  const anExtra = (overrides: Partial<MediaSummary> = {}): MediaSummary => ({
    ...summary,
    id: 'extra-1',
    title: 'Scoring the film',
    parentId: 'media-1',
    extraKind: 'featurette',
    ...overrides,
  });

  it('says nothing of them where a film carries none', async () => {
    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Synopsis')).toBeInTheDocument();
    });

    expect(screen.queryByText('Extras')).not.toBeInTheDocument();
  });

  it('lists them under a heading of their own', async () => {
    detailMock.mockResolvedValue({ ...detail(), extras: [anExtra()] });

    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Extras')).toBeInTheDocument();
    });

    expect(screen.getByText('Scoring the film')).toBeInTheDocument();
  });

  it('says what sort of extra each one is, so a trailer is not mistaken for the film', async () => {
    detailMock.mockResolvedValue({ ...detail(), extras: [anExtra({ extraKind: 'trailer' })] });

    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Trailer')).toBeInTheDocument();
    });
  });

  it('plays one when it is chosen, from the beginning', async () => {
    const onPlay = vi.fn();
    detailMock.mockResolvedValue({ ...detail(), extras: [anExtra()] });

    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={onPlay} />);

    await waitFor(() => {
      expect(screen.getByText('Scoring the film')).toBeInTheDocument();
    });

    await userEvent.setup().click(screen.getByText('Scoring the film'));

    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ id: 'extra-1' }), 0);
  });
});

describe('a film held as more than one cut of itself', () => {
  const blackAndWhite: MediaSummary = {
    ...summary,
    id: 'version-1',
    parentId: 'media-1',
    versionLabel: 'B&W',
  };

  it('offers no choice where a film is held only one way', async () => {
    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Play/ })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Which version to play' })).not.toBeInTheDocument();
  });

  it('offers the choice before playing rather than during', async () => {
    detailMock.mockResolvedValue({ ...detail(), versions: [blackAndWhite] });

    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Which version to play' })).toBeInTheDocument();
    });
  });

  it('starts on the film itself, which is what somebody pressing play expects', async () => {
    const onPlay = vi.fn();
    detailMock.mockResolvedValue({ ...detail(), versions: [blackAndWhite] });

    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={onPlay} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Which version to play' })).toBeInTheDocument();
    });

    await userEvent.setup().click(screen.getByRole('button', { name: /Play/ }));

    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ id: 'media-1' }), 0);
  });

  it('plays the cut that was chosen instead', async () => {
    const onPlay = vi.fn();
    detailMock.mockResolvedValue({ ...detail(), versions: [blackAndWhite] });

    renderInAnAddress(<MediaDetailDialog media={summary} onClose={vi.fn()} onPlay={onPlay} />);

    const actor = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Which version to play' })).toBeInTheDocument();
    });

    await actor.click(screen.getByRole('button', { name: 'Which version to play' }));
    await actor.click(await screen.findByRole('menuitemradio', { name: 'B&W' }));
    await actor.click(screen.getByRole('button', { name: /Play/ }));

    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ id: 'version-1' }), 0);
  });
});
