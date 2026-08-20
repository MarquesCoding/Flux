import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readSoundPreference, saveSoundPreference } from '@FluxClient/playback/soundPreference';
import { forgetSoundClaims } from '@FluxScreens/playback/soundOwner';
import { MediaPreview } from './MediaPreview';

const MEDIA_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';

const play = vi.fn().mockResolvedValue(undefined);
const pause = vi.fn();

/**
 * The clip, which jsdom draws as an element and never plays.
 */
const videoOf = (): HTMLVideoElement => screen.getByLabelText('Preview');

/**
 * Every clip on screen at once, for the pages that show more than one.
 */
const videosOf = (): HTMLVideoElement[] => screen.getAllByLabelText('Preview');

/**
 * The still, which is the item's own artwork rather than a frame of the clip.
 */
const stillOf = (container: HTMLElement): HTMLElement | null => container.querySelector('img');

const isShowing = (element: Element | null): boolean =>
  element?.className.includes('opacity-100') === true;

/**
 * Starts the clip the way the element itself would say it had.
 */
const startPlaying = async () => {
  await act(async () => {
    videoOf().dispatchEvent(new Event('play'));
    videoOf().dispatchEvent(new Event('playing'));
    await Promise.resolve();
  });
};

const endClip = async () => {
  await act(async () => {
    videoOf().dispatchEvent(new Event('ended'));
    await Promise.resolve();
  });
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  play.mockClear().mockResolvedValue(undefined);
  pause.mockClear();

  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause });
  Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
    configurable: true,
    get: () => false,
  });

  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue({ ok: true, status: 206, json: () => Promise.resolve({ tracks: [] }) }),
  );
});

const urlOf = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') {
    return input;
  }

  return input instanceof URL ? input.href : input.url;
};

const answersPreviewWith = (status: number) => {
  vi.mocked(fetch).mockImplementation((input) =>
    Promise.resolve(
      urlOf(input).endsWith('/preview')
        ? new Response(null, { status })
        : new Response(JSON.stringify({ tracks: [] }), { status: 200 }),
    ),
  );
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  forgetSoundClaims();
});

const settle = async () => {
  await act(async () => {
    vi.advanceTimersByTime(1500);
    await Promise.resolve();
  });
};

describe('MediaPreview', () => {
  it('opens on the artwork the item chose for itself', () => {
    const { container } = render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
      />,
    );

    expect(stillOf(container)).toHaveAttribute('src', '/artwork.jpg');
    expect(isShowing(stillOf(container))).toBe(true);
  });

  it('falls back to a frame of the film for an item nothing has artwork for', () => {
    const { container } = render(
      <MediaPreview mediaId={MEDIA_ID} backdropUrl={null} durationSeconds={7200} />,
    );

    expect(stillOf(container)?.getAttribute('src')).toContain('/frame?');
  });

  it('waits before starting anything, since reading a runtime is not choosing to watch', () => {
    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={1200}
      />,
    );

    expect(play).not.toHaveBeenCalled();
  });

  it('starts the clip once somebody has stayed', async () => {
    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={1200}
      />,
    );

    await settle();

    expect(play).toHaveBeenCalled();
  });

  it('starts silent, whatever else it offers', async () => {
    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        hasSound
      />,
    );

    await settle();

    expect(videoOf().muted).toBe(true);
  });

  it('shows the clip once it is running', async () => {
    const { container } = render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
      />,
    );

    await settle();
    await startPlaying();

    expect(isShowing(stillOf(container))).toBe(false);
  });

  it('does not put the still back over a clip that is only paused', async () => {
    const { container } = render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
      />,
    );

    await settle();
    await startPlaying();

    await act(async () => {
      videoOf().dispatchEvent(new Event('pause'));
      await Promise.resolve();
    });

    expect(isShowing(stillOf(container))).toBe(false);
  });

  it('runs again rather than falling back, where nothing is waiting for it', async () => {
    const { container } = render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
      />,
    );

    await settle();
    await startPlaying();
    await endClip();

    expect(isShowing(stillOf(container))).toBe(false);
  });

  it('goes back to the still when something is waiting for it', async () => {
    const onEnded = vi.fn();
    const { container } = render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        onEnded={onEnded}
      />,
    );

    await settle();
    await startPlaying();
    await endClip();

    expect(isShowing(stillOf(container))).toBe(true);
  });

  it('says it has finished, so a hero changes on a still rather than mid-shot', async () => {
    const onEnded = vi.fn();

    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        onEnded={onEnded}
      />,
    );

    await settle();
    await startPlaying();
    await endClip();

    expect(onEnded).toHaveBeenCalledOnce();
  });

  it('plays once when it is told to, even with nobody waiting', async () => {
    const { container } = render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        repeats={false}
      />,
    );

    await settle();
    await startPlaying();
    await endClip();

    expect(isShowing(stillOf(container))).toBe(true);
  });

  it('says when the picture starts moving, so what is over it can get out of the way', async () => {
    const onPlayingChange = vi.fn();

    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        onPlayingChange={onPlayingChange}
      />,
    );

    await settle();
    await startPlaying();

    expect(onPlayingChange).toHaveBeenCalledWith(true);
  });

  it('offers no controls until there is something to control', () => {
    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        hasSound
      />,
    );

    expect(screen.queryByRole('button', { name: /sound/i })).not.toBeInTheDocument();
  });

  it('offers nothing but sound, since a preview is not something to scrub through', async () => {
    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        hasSound
      />,
    );

    await settle();
    await startPlaying();

    expect(screen.queryByRole('button', { name: /preview/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Turn sound on' })).toBeInTheDocument();
  });

  it('puts the controls where a full-screen preview has room for them', async () => {
    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        hasSound
        controlsAtTop
      />,
    );

    await settle();
    await startPlaying();

    const controls = screen.getByRole('button', { name: 'Turn sound on' }).parentElement;

    expect(controls?.className).toContain('top-4');
    expect(controls?.className).not.toContain('bottom-4');
  });

  it('lets somebody ask for sound', async () => {
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        hasSound
      />,
    );

    await settle();
    await startPlaying();
    await actor.click(screen.getByRole('button', { name: 'Turn sound on' }));

    expect(videoOf().muted).toBe(false);
  });

  it('offers no sound where it was not asked to', async () => {
    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
      />,
    );

    await settle();
    await startPlaying();

    expect(screen.queryByRole('button', { name: 'Turn sound on' })).not.toBeInTheDocument();
  });

  it('says a preview is being made rather than showing an empty picture', async () => {
    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
      />,
    );

    answersPreviewWith(202);

    await settle();

    expect(await screen.findByText(/being made/i)).toBeInTheDocument();
    expect(play).not.toHaveBeenCalled();
  });

  it('says there is no preview when none is coming', async () => {
    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
      />,
    );

    answersPreviewWith(404);

    await settle();

    expect(await screen.findByText(/no preview available/i)).toBeInTheDocument();
    expect(play).not.toHaveBeenCalled();
  });

  it('does not ask for subtitles it was not asked to show', async () => {
    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
      />,
    );

    await settle();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(vi.mocked(fetch).mock.calls.map(([url]) => urlOf(url))).not.toContain(
      `/api/media/${MEDIA_ID}/subtitles`,
    );
  });

  it('asks what a viewer would be reading if they pressed play', async () => {
    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        hasSubtitles
      />,
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
  });

  it('gives sound back to somebody who asked for it last time', async () => {
    saveSoundPreference('audible');

    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        hasSound
      />,
    );

    await settle();

    await waitFor(() => {
      expect(videoOf().muted).toBe(false);
    });
  });

  it('still starts muted where sound was asked for, since a browser refuses otherwise', async () => {
    saveSoundPreference('audible');

    let wasMutedWhenPlayed: boolean | null = null;

    play.mockImplementation(() => {
      wasMutedWhenPlayed = videoOf().muted;

      return Promise.resolve();
    });

    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        hasSound
      />,
    );

    await settle();

    await waitFor(() => {
      expect(play).toHaveBeenCalled();
    });

    expect(wasMutedWhenPlayed).toBe(true);
  });

  it('stays silent where the caller never offered sound, whatever was remembered', async () => {
    saveSoundPreference('audible');

    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
      />,
    );

    await settle();
    await startPlaying();

    expect(videoOf().muted).toBe(true);
  });

  it('remembers that somebody asked for sound', async () => {
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        hasSound
      />,
    );

    await settle();
    await startPlaying();
    await actor.click(screen.getByRole('button', { name: 'Turn sound on' }));

    expect(readSoundPreference()).toBe('audible');
  });

  it('remembers that they turned it off again', async () => {
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    saveSoundPreference('audible');

    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        hasSound
      />,
    );

    await settle();
    await startPlaying();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Turn sound off' })).toBeInTheDocument();
    });

    await actor.click(screen.getByRole('button', { name: 'Turn sound off' }));

    expect(readSoundPreference()).toBe('muted');
  });

  it('lets only the newest clip be heard, so a dialog does not talk over the page behind it', async () => {
    saveSoundPreference('audible');

    render(
      <>
        <MediaPreview
          mediaId={MEDIA_ID}
          backdropUrl="/artwork.jpg"
          durationSeconds={7200}
          settleMilliseconds={0}
          hasSound
        />
        <MediaPreview
          mediaId="0f1d5f3e-6c2a-4a1e-9d77-2b9a1c4e8f01"
          backdropUrl="/artwork.jpg"
          durationSeconds={7200}
          settleMilliseconds={0}
          hasSound
        />
      </>,
    );

    await settle();

    await waitFor(() => {
      const clips = videosOf();

      expect(clips).toHaveLength(2);
      expect(clips[1]?.muted).toBe(false);
    });

    expect(videosOf()[0]?.muted).toBe(true);
  });

  it('gives the sound back to the page once what covered it has gone', async () => {
    saveSoundPreference('audible');

    const covering = (
      <MediaPreview
        mediaId="0f1d5f3e-6c2a-4a1e-9d77-2b9a1c4e8f01"
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        hasSound
      />
    );

    const behind = (
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        hasSound
      />
    );

    const { rerender } = render(
      <>
        {behind}
        {covering}
      </>,
    );

    await settle();

    rerender(<>{behind}</>);

    await waitFor(() => {
      expect(videoOf().muted).toBe(false);
    });
  });

  it('fades an audible clip out rather than cutting it off when it is taken away', async () => {
    saveSoundPreference('audible');

    const { unmount } = render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        hasSound
      />,
    );

    await settle();
    await startPlaying();

    await waitFor(() => {
      expect(videoOf().muted).toBe(false);
    });

    const element = videoOf();

    unmount();

    expect(element.src).not.toBe('');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(element.volume).toBe(0);
    expect(element.src).toBe('');
  });
});
