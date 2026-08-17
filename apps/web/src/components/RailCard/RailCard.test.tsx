import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RailCard } from './RailCard';
import type { MediaSummary } from '@FluxContracts/schemas/Library';

const MEDIA: MediaSummary = {
  id: '9c858901-8a57-4791-81fe-4c455b099bc9',
  libraryId: '00000000-0000-4000-8000-000000000000',
  title: 'Parasite',
  year: 2019,
  durationSeconds: 7920,
  width: 1920,
  height: 1080,
  videoCodec: 'h264',
  videoRange: 'SDR',
  addedAt: '2026-01-01T00:00:00.000Z',
  hasPoster: true,
  hasBackdrop: true,
  hasLogo: false,
  seriesId: null,
};

const DETAIL = {
  ...MEDIA,
  container: 'mkv',
  bitrateKbps: 12000,
  audioStreams: [{ index: 1, codec: 'aac', channels: 2, language: 'kor', isAtmos: false }],
  subtitleStreams: [{ index: 2, format: 'srt', language: 'eng', isForced: false }],
  metadata: {
    hasPoster: true,
    hasBackdrop: true,
    hasLogo: false,
    seriesId: null,
    seriesTitle: null,
    rating: 8.5,
    genres: ['Thriller', 'Drama'],
    overview: 'A family talks its way into another one.',
  },
};

/**
 * A pointer event that says what kind of pointer it came from.
 */
const pointerEvent = (kind: string, pointerType: string): Event => {
  const event = new MouseEvent(kind, { bubbles: true });

  Object.defineProperty(event, 'pointerType', { value: pointerType });

  return event;
};

/**
 * A mouse resting on the card, which is the only thing that opens it.
 */
const restOn = async (element: Element, pointerType = 'mouse') => {
  await act(async () => {
    element.dispatchEvent(pointerEvent('pointerover', pointerType));
    await Promise.resolve();
  });

  await act(async () => {
    vi.advanceTimersByTime(700);
    await Promise.resolve();
  });
};

/**
 * Lets whatever the card asked for arrive.
 */
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const cardHolder = (container: HTMLElement): Element => {
  const holder = container.firstElementChild;

  if (holder === null) {
    throw new Error('The card drew nothing.');
  }

  return holder;
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });

  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });

  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(DETAIL) }),
  );

  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('hover'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('RailCard', () => {
  it('draws the item it stands for', () => {
    render(<RailCard media={MEDIA} onPlay={vi.fn()} onInspect={vi.fn()} />);

    expect(screen.getByText('Parasite')).toBeInTheDocument();
  });

  it('opens the page when the card is chosen', async () => {
    const onInspect = vi.fn();
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<RailCard media={MEDIA} onPlay={vi.fn()} onInspect={onInspect} />);

    await actor.click(screen.getByRole('button', { name: /Parasite/ }));

    expect(onInspect).toHaveBeenCalledWith(MEDIA);
  });

  it('does not open on the way past, only where a pointer rests', () => {
    const { container } = render(<RailCard media={MEDIA} onPlay={vi.fn()} onInspect={vi.fn()} />);

    act(() => {
      cardHolder(container).dispatchEvent(pointerEvent('pointerover', 'mouse'));
    });

    expect(screen.queryByRole('button', { name: 'More about Parasite' })).not.toBeInTheDocument();
  });

  it('opens once a pointer has rested on it', async () => {
    const { container } = render(<RailCard media={MEDIA} onPlay={vi.fn()} onInspect={vi.fn()} />);

    await restOn(cardHolder(container));

    expect(screen.getByRole('button', { name: 'More about Parasite' })).toBeInTheDocument();
  });

  it('does not open for a finger, which has nowhere to rest', async () => {
    const { container } = render(<RailCard media={MEDIA} onPlay={vi.fn()} onInspect={vi.fn()} />);

    await restOn(cardHolder(container), 'touch');

    expect(screen.queryByRole('button', { name: 'More about Parasite' })).not.toBeInTheDocument();
  });

  it('reads the rest of what is known about the item once it is open', async () => {
    const { container } = render(<RailCard media={MEDIA} onPlay={vi.fn()} onInspect={vi.fn()} />);

    await restOn(cardHolder(container));
    await flush();

    expect(screen.getByText('A family talks its way into another one.')).toBeInTheDocument();
  });

  it('names the genres, up to the number worth naming', async () => {
    const { container } = render(<RailCard media={MEDIA} onPlay={vi.fn()} onInspect={vi.fn()} />);

    await restOn(cardHolder(container));
    await flush();

    expect(screen.getByText('Thriller')).toBeInTheDocument();
  });

  it('opens the page from anywhere on the open card, not from a small button', async () => {
    const onInspect = vi.fn();
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(<RailCard media={MEDIA} onPlay={vi.fn()} onInspect={onInspect} />);

    await restOn(cardHolder(container));
    await actor.click(screen.getByRole('button', { name: 'More about Parasite' }));

    expect(onInspect).toHaveBeenCalledWith(MEDIA);
  });

  it('plays from the open card without also opening the page behind it', async () => {
    const onPlay = vi.fn();
    const onInspect = vi.fn();
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(<RailCard media={MEDIA} onPlay={onPlay} onInspect={onInspect} />);

    await restOn(cardHolder(container));
    await actor.click(screen.getByRole('button', { name: 'Play' }));

    expect(onPlay).toHaveBeenCalledWith(MEDIA, 0);
    expect(onInspect).not.toHaveBeenCalled();
  });

  it('offers to resume where somebody left it', async () => {
    const onPlay = vi.fn();
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(
      <RailCard
        media={MEDIA}

        resumeSeconds={2103}
        onPlay={onPlay}
        onInspect={vi.fn()}
      />,
    );

    await restOn(cardHolder(container));
    await actor.click(screen.getByRole('button', { name: /Resume from/ }));

    expect(onPlay).toHaveBeenCalledWith(MEDIA, 2103);
  });

  it('closes when the pointer leaves', async () => {
    const { container } = render(<RailCard media={MEDIA} onPlay={vi.fn()} onInspect={vi.fn()} />);

    await restOn(cardHolder(container));

    await act(async () => {
      screen
        .getByRole('button', { name: 'More about Parasite' })
        .parentElement?.dispatchEvent(pointerEvent('pointerout', 'mouse'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'More about Parasite' })).not.toBeInTheDocument();
    });
  });
});
