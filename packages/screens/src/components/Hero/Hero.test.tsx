import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderInAnAddress } from '@ValenceScreens/testing/renderInAnAddress';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { coverPage, forgetPageCovers } from '@ValenceUI/pageCover';
import { Hero } from './Hero';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';
import type { MediaPreviewProps } from '@ValenceScreens/components/MediaPreview/MediaPreview.types';
import type * as MotionModule from 'motion/react';

const { previewMock } = vi.hoisted(() => ({ previewMock: vi.fn() }));

vi.mock('@ValenceScreens/components/MediaPreview/MediaPreview', () => ({
  MediaPreview: (props: MediaPreviewProps) => {
    previewMock(props);

    return <div>preview</div>;
  },
}));

const { ticks } = vi.hoisted(() => ({ ticks: new Set<(time: number, delta: number) => void>() }));

vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof MotionModule>()),
  useAnimationFrame: (callback: (time: number, delta: number) => void) => {
    ticks.clear();
    ticks.add(callback);
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
  vi.restoreAllMocks();
  vi.useRealTimers();
  forgetPageCovers();
});

/**
 * Runs the frames that would be drawn over a stretch of time, since the turning is counted in
 * frames rather than by a timer.
 */
const frames = (milliseconds: number) => {
  act(() => {
    for (let passed = 0; passed < milliseconds; passed += 16) {
      for (const tick of ticks) {
        tick(passed, 16);
      }
    }
  });
};

describe('Hero', () => {
  it('offers the featured clip sound, with nothing to read laid over it', () => {
    renderInAnAddress(<Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} />);

    expect(previewMock).toHaveBeenCalledWith(expect.objectContaining({ hasSound: true }));
    expect(previewMock.mock.calls[0]?.[0]).not.toHaveProperty('hasSubtitles');
  });

  it('stands as a card beneath the bar rather than filling the page', () => {
    renderInAnAddress(<Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Featured' })).toHaveClass('rounded-[20px]');
  });

  it('holds its place while the page scrolls over it, where it is asked to stay behind', () => {
    const { container } = renderInAnAddress(
      <Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} staysBehind />,
    );

    expect(container.querySelector('.sticky')).not.toBeNull();
  });

  it('scrolls away with the page where it is not', () => {
    const { container } = renderInAnAddress(
      <Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} />,
    );

    expect(container.querySelector('.sticky')).toBeNull();
  });

  it('recedes as it is covered rather than being scrolled off the top, where it stays behind', () => {
    renderInAnAddress(<Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} staysBehind />);

    expect(screen.getByRole('region', { name: 'Featured' }).style.opacity).toBe('1');
  });

  it('leaves itself alone where it is not staying behind', () => {
    renderInAnAddress(<Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Featured' }).style.opacity).toBe('');
  });

  it('fills what it is put in where there is nothing to scroll', () => {
    const { container } = renderInAnAddress(
      <Hero items={[item('a', 'Arrival')]} onPlay={vi.fn()} fills staysBehind />,
    );

    expect(container.firstElementChild).toHaveClass('h-[calc(100svh-var(--valence-window-bar))]');
    expect(container.querySelector('.sticky')).toBeNull();
    expect(screen.getByRole('region', { name: 'Featured' })).not.toHaveClass('rounded-[20px]');
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

    frames(500);

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument();

    act(() => {
      uncover();
    });

    frames(150);

    expect(screen.getByRole('heading', { name: 'Dune' })).toBeInTheDocument();
  });

  it('moves on after a while', () => {
    renderInAnAddress(<Hero items={items} onPlay={vi.fn()} rotateAfterMilliseconds={100} />);

    frames(150);

    expect(screen.getByRole('heading', { name: 'Dune' })).toBeInTheDocument();
  });

  it('comes back round to the beginning', () => {
    renderInAnAddress(<Hero items={items} onPlay={vi.fn()} rotateAfterMilliseconds={100} />);

    frames(150);

    expect(screen.getByRole('heading', { name: 'Dune' })).toBeInTheDocument();

    frames(150);
    frames(150);

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument();
  });

  it('holds still while someone is pointing at what it says', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderInAnAddress(<Hero items={items} onPlay={vi.fn()} rotateAfterMilliseconds={100} />);

    await user.hover(screen.getByRole('button', { name: /Play/ }));
    frames(500);

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument();
  });

  it('keeps turning while the pointer only rests on the picture', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderInAnAddress(<Hero items={items} onPlay={vi.fn()} rotateAfterMilliseconds={100} />);

    await user.hover(screen.getByText('preview'));

    frames(150);

    expect(screen.getByRole('heading', { name: 'Dune' })).toBeInTheDocument();
  });

  it('counts down to the next one on the dots, drawn light over the picture', () => {
    renderInAnAddress(<Hero items={items} onPlay={vi.fn()} rotateAfterMilliseconds={100} />);

    const dots = screen.getByRole('list', { name: 'Featured items' });

    expect(dots.querySelector('[data-slot="page-dots-fill"]')).not.toBeNull();
    expect(dots.querySelector('.bg-on-scrim')).not.toBeNull();
  });

  it('carries on turning after a dot is chosen, rather than stopping there', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- called back on its own element below
    const matches = Element.prototype.matches;

    vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
      this: Element,
      selector: string,
    ) {
      return selector === ':focus-visible' ? false : matches.call(this, selector);
    });

    renderInAnAddress(<Hero items={items} onPlay={vi.fn()} rotateAfterMilliseconds={100} />);

    await user.click(screen.getByRole('button', { name: 'Show Sicario' }));

    expect(await screen.findByRole('heading', { name: 'Sicario' })).toBeInTheDocument();

    frames(150);

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument();
  });

  it('holds still while someone is tabbing through it', () => {
    renderInAnAddress(<Hero items={items} onPlay={vi.fn()} rotateAfterMilliseconds={100} />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      screen.getByRole('button', { name: /Play/ }).focus();
    });

    frames(500);

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

    frames(500);

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
      '/api/media/a/image/logo?at=full',
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
});
