import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderInAnAddress } from '@ValenceScreens/testing/renderInAnAddress';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { coverPage, forgetPageCovers } from '@ValenceUI/pageCover';
import { Hero } from './Hero';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';
import type { MediaPreviewProps } from '@ValenceScreens/components/MediaPreview/MediaPreview.types';

const { previewMock } = vi.hoisted(() => ({ previewMock: vi.fn() }));

vi.mock('@ValenceScreens/components/MediaPreview/MediaPreview', () => ({
  MediaPreview: (props: MediaPreviewProps) => {
    previewMock(props);

    return <div>preview</div>;
  },
}));

const { detailMock } = vi.hoisted(() => ({ detailMock: vi.fn() }));

vi.mock('@ValenceClient/library/fetchLibrary', () => ({ fetchMediaDetail: detailMock }));

const item = (id: string, title: string): MediaSummary => ({
  id,
  libraryId: 'library-1',
  title,
  year: 2016,
  durationSeconds: 7200,
  width: 1920,
  height: 1080,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: false,
  hasBackdrop: true,
  hasLogo: false,
  seriesId: null,
});

const items = [item('a', 'Arrival'), item('b', 'Dune'), item('c', 'Sicario')];

beforeEach(() => {
  previewMock.mockReset();
  detailMock.mockReset();
  detailMock.mockReturnValue(Promise.resolve(null));
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  forgetPageCovers();
});

describe('Hero', () => {
  it('offers the featured clip sound, and reads it aloud in writing either way', () => {
    renderInAnAddress(<Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} />);

    expect(previewMock).toHaveBeenCalledWith(
      expect.objectContaining({ hasSound: true, hasSubtitles: true }),
    );
  });

  it('stands in a runway by default, so the page can scroll beneath it', () => {
    const { container } = renderInAnAddress(
      <Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} />,
    );
    const runway = container.firstElementChild;

    expect(runway).toHaveStyle({ marginBottom: '-24svh' });
    expect(container.querySelector('.sticky')).not.toBeNull();
  });

  it('fills what it is put in where there is nothing to scroll', () => {
    const { container } = renderInAnAddress(
      <Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} fills />,
    );
    const runway = container.firstElementChild;

    expect(runway).toHaveStyle({ height: 'calc(100svh - var(--valence-window-bar))' });
    expect(runway).not.toHaveStyle({ marginBottom: '-24svh' });
    expect(container.querySelector('.sticky')).toBeNull();
  });

  it('says there is more underneath, where there is', () => {
    const { container } = renderInAnAddress(
      <Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} />,
    );

    expect(container.querySelector('[aria-hidden] svg')).not.toBeNull();
  });

  it('stands clear of whatever the shell puts along the bottom', () => {
    const { container } = renderInAnAddress(
      <Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} />,
    );
    const mark = container.querySelector('[aria-hidden] svg')?.parentElement;

    expect(mark?.className).toContain('var(--dock-clearance,0px)');
  });

  it('says nothing of the sort when it fills what it is in and nothing is below', () => {
    const { container } = renderInAnAddress(
      <Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} fills />,
    );

    expect(container.querySelector('[aria-hidden] svg')).toBeNull();
  });

  it('shows nothing at all when there is nothing to feature', () => {
    const { container } = renderInAnAddress(<Hero items={[]} onPlay={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('features the first item', () => {
    renderInAnAddress(<Hero items={items} onPlay={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument();
  });

  it('names itself so the section can be found', () => {
    renderInAnAddress(<Hero items={items} onPlay={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Featured' })).toBeInTheDocument();
  });

  it('plays what is featured', async () => {
    const onPlay = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderInAnAddress(<Hero items={items} onPlay={onPlay} />);

    await user.click(screen.getByRole('button', { name: /Play/ }));

    expect(onPlay).toHaveBeenCalledWith(items[0], 0);
  });

  it('carries on rather than starting again when there is somewhere to carry on from', async () => {
    const onPlay = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderInAnAddress(<Hero items={items} onPlay={onPlay} resumeFor={() => 620} />);

    await user.click(screen.getByRole('button', { name: /Resume/ }));

    expect(onPlay).toHaveBeenCalledWith(items[0], 620);
  });

  it('says which item is on screen, so the page can be lit by it', () => {
    const onFeatureChange = vi.fn();
    renderInAnAddress(<Hero items={items} onPlay={vi.fn()} onFeatureChange={onFeatureChange} />);

    expect(onFeatureChange).toHaveBeenCalledWith(items[0]);
  });

  it('holds the featured clip still while something is standing over the page', () => {
    coverPage();

    renderInAnAddress(<Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} />);

    expect(previewMock).toHaveBeenCalledWith(expect.objectContaining({ isHeld: true }));
  });

  it('lets it play on while nothing is', () => {
    renderInAnAddress(<Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} />);

    expect(previewMock).toHaveBeenCalledWith(expect.objectContaining({ isHeld: false }));
  });

  it('holds still while something is standing over the page', () => {
    const uncover = coverPage();

    renderInAnAddress(<Hero items={items} onPlay={vi.fn()} rotateAfterMilliseconds={100} />);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument();

    act(() => {
      uncover();
    });

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByRole('heading', { name: 'Dune' })).toBeInTheDocument();
  });

  it('moves on after a while', () => {
    renderInAnAddress(<Hero items={items} onPlay={vi.fn()} rotateAfterMilliseconds={100} />);

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByRole('heading', { name: 'Dune' })).toBeInTheDocument();
  });

  it('comes back round to the beginning', async () => {
    renderInAnAddress(<Hero items={items} onPlay={vi.fn()} rotateAfterMilliseconds={100} />);

    for (let turn = 0; turn < items.length; turn += 1) {
      act(() => {
        vi.advanceTimersByTime(150);
      });
    }

    expect(await screen.findByRole('heading', { name: 'Arrival' })).toBeInTheDocument();
  });

  it('holds still while someone is reading it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderInAnAddress(<Hero items={items} onPlay={vi.fn()} rotateAfterMilliseconds={100} />);

    await user.hover(screen.getByRole('region', { name: 'Featured' }));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument();
  });

  it('holds still while someone is tabbing through it', () => {
    renderInAnAddress(<Hero items={items} onPlay={vi.fn()} rotateAfterMilliseconds={100} />);

    act(() => {
      screen.getByRole('button', { name: /Play/ }).focus();
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument();
  });

  it('never rotates when there is only one thing to show', () => {
    renderInAnAddress(
      <Hero
        items={[items[0] ?? item('a', 'Arrival')]}
        onPlay={vi.fn()}

        rotateAfterMilliseconds={100}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Show / })).not.toBeInTheDocument();
  });

  it('jumps straight to an item on request', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderInAnAddress(<Hero items={items} onPlay={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Show Sicario' }));

    expect(await screen.findByRole('heading', { name: 'Sicario' })).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(Hero.displayName).toBe('Hero');
  });

  it('lets a programme’s own lettering stand as the title', () => {
    renderInAnAddress(
      <Hero items={[{ ...item('a', 'Arrival'), hasLogo: true }]} onPlay={vi.fn()} />,
    );

    const heading = screen.getByRole('heading', { name: 'Arrival' });

    expect(within(heading).getByRole('img', { name: 'Arrival' })).toHaveAttribute(
      'src',
      '/api/media/a/image/logo',
    );
  });

  it('sets the name in words for a programme that has no lettering', () => {
    renderInAnAddress(<Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Arrival' })).toHaveTextContent('Arrival');
  });

  it('falls back to words when the lettering will not load', async () => {
    renderInAnAddress(
      <Hero items={[{ ...item('a', 'Arrival'), hasLogo: true }]} onPlay={vi.fn()} />,
    );

    fireEvent.error(screen.getByRole('img', { name: 'Arrival' }));

    expect(await screen.findByText('Arrival')).toBeInTheDocument();
  });

  it('introduces the programme rather than tonight’s episode', () => {
    renderInAnAddress(
      <Hero
        items={[{ ...item('a', 'Episode Four'), seriesTitle: 'Some Show', episodeNumber: 4 }]}
        onPlay={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Some Show' })).toBeInTheDocument();
    expect(screen.queryByText('Episode Four')).not.toBeInTheDocument();
    expect(screen.queryByText('EP4')).not.toBeInTheDocument();
  });

  it('says what the thing is about', async () => {
    detailMock.mockReturnValue(
      Promise.resolve({ metadata: { overview: 'A linguist meets the arrival.' } }),
    );

    renderInAnAddress(<Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} />);

    expect(await screen.findByText('A linguist meets the arrival.')).toBeInTheDocument();
  });

  it('stops saying it after a while, so the picture is not covered for ever', async () => {
    detailMock.mockReturnValue(
      Promise.resolve({ metadata: { overview: 'A linguist meets the arrival.' } }),
    );

    renderInAnAddress(<Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} />);

    await screen.findByText('A linguist meets the arrival.');

    act(() => {
      vi.advanceTimersByTime(9000);
    });

    await waitFor(() => {
      expect(screen.queryByText('A linguist meets the arrival.')).not.toBeInTheDocument();
    });
  });

  it('says nothing at all about something the catalogue has no words for', async () => {
    detailMock.mockReturnValue(Promise.resolve({ metadata: { overview: null } }));

    renderInAnAddress(<Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument();
  });
  it('does not take the pointer for the page it is pulled up over', () => {
    renderInAnAddress(<Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} onInspect={vi.fn()} />);

    const card = screen.getByLabelText('Featured');
    const runway = card.parentElement?.parentElement;

    expect(runway).toHaveClass('pointer-events-none');
    expect(card).toHaveClass('pointer-events-auto');
  });
});
