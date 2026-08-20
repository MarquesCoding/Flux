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
});

type Watched = z.infer<typeof WatchedSchema> | null;

const seen: Watched[] = [];

const heard = (event: Event) => {
  seen.push(event instanceof CustomEvent ? WatchedSchema.nullable().catch(null).parse(event.detail) : null);
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

  it('says when it will end, so Discord counts for itself', () => {
    watching({ positionSeconds: 200 });

    const detail = said();

    expect((detail?.endsAt ?? 0) - (detail?.startedAt ?? 0)).toBe(1_200_000);
  });

  it('offers the catalogue id, which becomes the button', () => {
    watching();

    expect(said()).toMatchObject({ tmdbId: '1399', isSeries: true });
  });

  it('says nothing at all where the profile did not ask, which is the default', () => {
    watching({ isAllowed: false });

    expect(said()).toBeNull();
  });

  it('says nothing while paused, since somebody who stopped is not watching', () => {
    watching({ isPlaying: false });

    expect(said()).toBeNull();
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
});
