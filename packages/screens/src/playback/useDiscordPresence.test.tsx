import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { z } from 'zod';
import { useDiscordPresence } from './useDiscordPresence';
import type { DiscordPresence } from './useDiscordPresence';

const WatchedSchema = z.object({
  title: z.string(),
  series: z.string().nullable(),
  season: z.number().nullable(),
  episode: z.number().nullable(),
  startedAt: z.number(),
  endsAt: z.number().nullable(),
  tmdbId: z.string().nullable(),
  isSeries: z.boolean(),
  isPaused: z.boolean(),
});

type Watched = z.infer<typeof WatchedSchema> | null;

const KindSchema = z.object({ kind: z.string() }).nullable().catch(null);

const seen: Watched[] = [];

const heard = (event: Event) => {
  seen.push(
    event instanceof CustomEvent ? WatchedSchema.nullable().catch(null).parse(event.detail) : null,
  );
};

const AN_EPISODE = {
  id: 'a-media-id',
  title: 'The One With The Thing',
  seriesTitle: 'A Programme',
  seasonNumber: 2,
  episodeNumber: 12,
  externalId: '1399',
  durationSeconds: 1400,
};

const said = (): Watched | undefined => seen.at(-1);

const watching = (overrides: Partial<DiscordPresence> = {}) => {
  const Showing = () => {
    useDiscordPresence({
      media: AN_EPISODE,
      isPlaying: true,
      positionSeconds: 0,
      isAllowed: true,
      ...overrides,
    });

    return null;
  };

  return render(<Showing />);
};

beforeEach(() => {
  seen.length = 0;
  document.documentElement.dataset['fluxDesktop'] = 'true';
  document.addEventListener('flux:now-watching', heard);
});

afterEach(() => {
  document.removeEventListener('flux:now-watching', heard);
  delete document.documentElement.dataset['fluxDesktop'];
});

describe('useDiscordPresence', () => {
  it('says what is playing where the profile asked for it', () => {
    watching();

    expect(said()).toMatchObject({
      title: 'The One With The Thing',
      series: 'A Programme',
      season: 2,
      episode: 12,
    });
  });

  it('spans the whole thing, so the bar reads as a place in it and not as time spent looking', () => {
    watching({ positionSeconds: 200 });

    const detail = said();

    expect((detail?.endsAt ?? 0) - (detail?.startedAt ?? 0)).toBe(1_400_000);
  });

  it('starts as far behind now as somebody is into it, which is what Discord draws as elapsed', () => {
    watching({ positionSeconds: 200 });

    const behind = Date.now() - (said()?.startedAt ?? 0);

    expect(behind).toBeGreaterThanOrEqual(200_000);
    expect(behind).toBeLessThan(205_000);
  });

  it('offers the catalogue id, which becomes the button', () => {
    watching();

    expect(said()).toMatchObject({ tmdbId: '1399', isSeries: true });
  });

  it('says nothing at all where the profile did not ask, which is the default', () => {
    watching({ isAllowed: false });

    expect(said()).toBeNull();
  });

  it('keeps saying what is open while paused, since a pause is not leaving', () => {
    watching({ isPlaying: false });

    expect(said()?.title).toBe(AN_EPISODE.title);
  });

  it('says nothing in a browser, which has no window to publish it', () => {
    delete document.documentElement.dataset['fluxDesktop'];

    watching();

    expect(said()).toBeNull();
  });

  it('clears when the player goes, rather than leaving somebody shown as watching', () => {
    const { unmount } = watching();

    unmount();

    expect(said()).toBeNull();
  });

  it('says a film belongs to no programme', () => {
    watching({
      media: { id: 'a-film', title: 'A Film', externalId: '550', durationSeconds: 7000 },
    });

    expect(said()).toMatchObject({ series: null, isSeries: false });
  });

  it('does not clear and re-say the status as the position moves, which cleared it twice a second', () => {
    const AtPosition = ({ positionSeconds }: { positionSeconds: number }) => {
      useDiscordPresence({
        media: AN_EPISODE,
        isPlaying: true,
        positionSeconds,
        isAllowed: true,
        party: null,
      });

      return null;
    };

    const { rerender } = render(<AtPosition positionSeconds={10} />);

    seen.length = 0;

    for (let second = 11; second <= 24; second += 1) {
      rerender(<AtPosition positionSeconds={second} />);
    }

    expect(seen.length).toBeLessThanOrEqual(1);
  });

  it('says it again once the time left has moved far enough that a seek would have', () => {
    const AtPosition = ({ positionSeconds }: { positionSeconds: number }) => {
      useDiscordPresence({
        media: AN_EPISODE,
        isPlaying: true,
        positionSeconds,
        isAllowed: true,
        party: null,
      });

      return null;
    };

    const { rerender } = render(<AtPosition positionSeconds={10} />);

    seen.length = 0;

    rerender(<AtPosition positionSeconds={400} />);

    expect(seen.at(-1)?.title).toBe(AN_EPISODE.title);
  });

  it('stays on what is open when it is paused, since a pause is not going back to the library', () => {
    const raw: (string | null)[] = [];
    const listen = (event: Event) => {
      const said = event instanceof CustomEvent ? KindSchema.parse(event.detail) : null;

      raw.push(said === null ? null : said.kind);
    };

    document.addEventListener('flux:now-watching', listen);

    const Showing = ({ isPlaying }: { isPlaying: boolean }) => {
      useDiscordPresence({
        media: AN_EPISODE,
        isPlaying,
        positionSeconds: 10,
        isAllowed: true,
        party: null,
      });

      return null;
    };

    const { rerender } = render(<Showing isPlaying />);

    raw.length = 0;

    rerender(<Showing isPlaying={false} />);

    document.removeEventListener('flux:now-watching', listen);

    expect(raw).toContain('watching');
    expect(raw).not.toContain('browsing');
  });

  it('still says nothing at all where the profile never asked to be shown', () => {
    const raw: (string | null)[] = [];
    const listen = (event: Event) => {
      const said = event instanceof CustomEvent ? KindSchema.parse(event.detail) : null;

      raw.push(said === null ? null : said.kind);
    };

    document.addEventListener('flux:now-watching', listen);

    const Showing = () => {
      useDiscordPresence({
        media: AN_EPISODE,
        isPlaying: false,
        positionSeconds: 0,
        isAllowed: false,
        party: null,
      });

      return null;
    };

    render(<Showing />);

    document.removeEventListener('flux:now-watching', listen);

    expect(raw).not.toContain('browsing');
    expect(raw.at(-1)).toBeNull();
  });

  it('goes back to browsing on the way out of the player, which is leaving rather than pausing', () => {
    const raw: (string | null)[] = [];
    const listen = (event: Event) => {
      const said = event instanceof CustomEvent ? KindSchema.parse(event.detail) : null;

      raw.push(said === null ? null : said.kind);
    };

    document.addEventListener('flux:now-watching', listen);

    const { unmount } = watching({ isAllowed: true, isPlaying: true });

    raw.length = 0;

    unmount();

    document.removeEventListener('flux:now-watching', listen);

    expect(raw).toContain('browsing');
  });

  it('says a pause is a pause, so the window can take the clock off', () => {
    watching({ isPlaying: false });

    expect(said()).toMatchObject({ isPaused: true });
  });
});
