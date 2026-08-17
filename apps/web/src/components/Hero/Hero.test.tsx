import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderInACache } from '@FluxWeb/testing/renderInACache';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hero } from './Hero';
import type { MediaSummary } from '@FluxContracts/schemas/Library';

vi.mock('@FluxWeb/components/MediaPreview/MediaPreview', () => ({
  MediaPreview: () => <div>preview</div>,
}));

const { detailMock } = vi.hoisted(() => ({ detailMock: vi.fn() }));

vi.mock('@FluxWeb/library/fetchLibrary', () => ({ fetchMediaDetail: detailMock }));

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
  detailMock.mockReset();
  detailMock.mockReturnValue(Promise.resolve(null));
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Hero', () => {
  it('stands in a runway by default, so the page can scroll beneath it', () => {
    const { container } = renderInACache(<Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} />);
    const runway = container.firstElementChild;

    expect(runway).toHaveStyle({ marginBottom: '-24svh' });
    expect(container.querySelector('.sticky')).not.toBeNull();
  });

  it('fills what it is put in where there is nothing to scroll', () => {
    const { container } = renderInACache(
      <Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} fills />,
    );
    const runway = container.firstElementChild;

    expect(runway).toHaveStyle({ height: '100svh' });
    expect(runway).not.toHaveStyle({ marginBottom: '-24svh' });
    expect(container.querySelector('.sticky')).toBeNull();
  });

  it('shows nothing at all when there is nothing to feature', () => {
    const { container } = renderInACache(<Hero items={[]} onPlay={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('features the first item', () => {
    renderInACache(<Hero items={items} onPlay={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument();
  });

  it('names itself so the section can be found', () => {
    renderInACache(<Hero items={items} onPlay={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Featured' })).toBeInTheDocument();
  });

  it('plays what is featured', async () => {
    const onPlay = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderInACache(<Hero items={items} onPlay={onPlay} />);

    await user.click(screen.getByRole('button', { name: /Play/ }));

    expect(onPlay).toHaveBeenCalledWith(items[0], 0);
  });

  it('carries on rather than starting again when there is somewhere to carry on from', async () => {
    const onPlay = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderInACache(<Hero items={items} onPlay={onPlay} resumeFor={() => 620} />);

    await user.click(screen.getByRole('button', { name: /Resume/ }));

    expect(onPlay).toHaveBeenCalledWith(items[0], 620);
  });

  it('says which item is on screen, so the page can be lit by it', () => {
    const onFeatureChange = vi.fn();
    renderInACache(<Hero items={items} onPlay={vi.fn()} onFeatureChange={onFeatureChange} />);

    expect(onFeatureChange).toHaveBeenCalledWith(items[0]);
  });

  it('moves on after a while', () => {
    renderInACache(<Hero items={items} onPlay={vi.fn()} rotateAfterMilliseconds={100} />);

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByRole('heading', { name: 'Dune' })).toBeInTheDocument();
  });

  it('comes back round to the beginning', async () => {
    renderInACache(<Hero items={items} onPlay={vi.fn()} rotateAfterMilliseconds={100} />);

    for (let turn = 0; turn < items.length; turn += 1) {
      act(() => {
        vi.advanceTimersByTime(150);
      });
    }

    expect(await screen.findByRole('heading', { name: 'Arrival' })).toBeInTheDocument();
  });

  it('holds still while someone is reading it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderInACache(<Hero items={items} onPlay={vi.fn()} rotateAfterMilliseconds={100} />);

    await user.hover(screen.getByRole('region', { name: 'Featured' }));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument();
  });

  it('holds still while someone is tabbing through it', () => {
    renderInACache(<Hero items={items} onPlay={vi.fn()} rotateAfterMilliseconds={100} />);

    act(() => {
      screen.getByRole('button', { name: /Play/ }).focus();
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument();
  });

  it('never rotates when there is only one thing to show', () => {
    renderInACache(
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
    renderInACache(<Hero items={items} onPlay={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Show Sicario' }));

    expect(await screen.findByRole('heading', { name: 'Sicario' })).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(Hero.displayName).toBe('Hero');
  });

  it('lets a programme’s own lettering stand as the title', () => {
    renderInACache(<Hero items={[{ ...item('a', 'Arrival'), hasLogo: true }]} onPlay={vi.fn()} />);

    const heading = screen.getByRole('heading', { name: 'Arrival' });

    expect(within(heading).getByRole('img', { name: 'Arrival' })).toHaveAttribute(
      'src',
      '/api/media/a/image/logo',
    );
  });

  it('sets the name in words for a programme that has no lettering', () => {
    renderInACache(<Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Arrival' })).toHaveTextContent('Arrival');
  });

  it('falls back to words when the lettering will not load', async () => {
    renderInACache(<Hero items={[{ ...item('a', 'Arrival'), hasLogo: true }]} onPlay={vi.fn()} />);

    fireEvent.error(screen.getByRole('img', { name: 'Arrival' }));

    expect(await screen.findByText('Arrival')).toBeInTheDocument();
  });

  it('introduces the programme rather than tonight’s episode', () => {
    renderInACache(
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

    renderInACache(<Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} />);

    expect(await screen.findByText('A linguist meets the arrival.')).toBeInTheDocument();
  });

  it('stops saying it after a while, so the picture is not covered for ever', async () => {
    detailMock.mockReturnValue(
      Promise.resolve({ metadata: { overview: 'A linguist meets the arrival.' } }),
    );

    renderInACache(<Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} />);

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

    renderInACache(<Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument();
  });
  it('does not take the pointer for the page it is pulled up over', () => {
    renderInACache(<Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} onInspect={vi.fn()} />);

    const card = screen.getByLabelText('Featured');
    const runway = card.parentElement?.parentElement;

    expect(runway).toHaveClass('pointer-events-none');
    expect(card).toHaveClass('pointer-events-auto');
  });
});
