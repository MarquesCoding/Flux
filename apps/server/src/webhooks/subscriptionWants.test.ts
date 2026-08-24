import { describe, expect, it } from 'vitest';
import { DEFAULT_WEBHOOK_FILTERS } from '@ValenceContracts/schemas/Webhook';
import { subscriptionWants } from './subscriptionWants';
import type { SubscriptionInterest } from './subscriptionWants';
import type { WebhookFilters } from '@ValenceContracts/schemas/Webhook';
import type { WebhookOccurrence } from '@ValenceServer/events/EventBus';

const anItem = {
  itemId: 'item-1',
  kind: 'movie' as const,
  title: 'Dune',
  seriesTitle: null,
  seasonNumber: null,
  episodeNumber: null,
  year: 2021,
  posterUrl: null,
  libraryId: 'library-1',
  libraryName: 'Films',
  overview: null,
  durationSeconds: null,
  genres: [],
  rating: null,
  quality: null,
};

const anArrival: WebhookOccurrence = { event: 'media.added', data: anItem };

const aFailure: WebhookOccurrence = {
  event: 'job.failed',
  data: {
    kind: 'library.scan',
    label: 'Scan for changes',
    jobId: 'job-1',
    subject: null,
    subjectName: null,
    reason: 'no space left',
  },
};

const aSignIn: WebhookOccurrence = {
  event: 'auth.succeeded',
  data: { accountId: 'account-1', name: 'Ada', deviceLabel: 'Chrome on macOS', address: null },
};

const aRefusal: WebhookOccurrence = {
  event: 'auth.failed',
  data: {
    identifier: 'ada@example.com',
    deviceLabel: 'Chrome on macOS',
    address: null,
    reason: 'those details were not accepted.',
  },
};

const aViewing = (
  overrides: Partial<{ accountId: string | null; profileId: string | null }> = {},
): WebhookOccurrence => ({
  event: 'playback.started',
  data: {
    accountId: 'account-1',
    accountName: 'Ada',
    profileId: 'profile-1',
    profileName: 'Ada',
    item: anItem,
    deviceLabel: 'Chrome on macOS',
    mode: 'DirectPlay',
    ...overrides,
  },
});

const asking = (
  events: WebhookOccurrence['event'][],
  filters: Partial<WebhookFilters> = {},
): SubscriptionInterest => ({
  events,
  filters: { ...DEFAULT_WEBHOOK_FILTERS, ...filters },
});

describe('subscriptionWants', () => {
  it('wants an event it asked for', () => {
    expect(subscriptionWants(asking(['job.failed']), aFailure)).toBe(true);
  });

  it('does not want an event it never asked for', () => {
    expect(subscriptionWants(asking(['job.completed']), aFailure)).toBe(false);
  });

  it('holds back an arrival from a subscription that wants the scan to speak for it', () => {
    expect(subscriptionWants(asking(['media.added']), anArrival)).toBe(false);
  });

  it('delivers an arrival to a subscription that asked for them one at a time', () => {
    expect(subscriptionWants(asking(['media.added'], { mediaAdded: 'perItem' }), anArrival)).toBe(
      true,
    );
  });
});

describe('subscriptionWants, filtering by account', () => {
  it('delivers to a subscription that named nobody, which means everybody', () => {
    expect(subscriptionWants(asking(['auth.succeeded']), aSignIn)).toBe(true);
  });

  it('delivers a sign-in by an account that was named', () => {
    expect(
      subscriptionWants(asking(['auth.succeeded'], { accounts: ['account-1'] }), aSignIn),
    ).toBe(true);
  });

  it('holds back a sign-in by an account that was not named', () => {
    expect(
      subscriptionWants(asking(['auth.succeeded'], { accounts: ['account-2'] }), aSignIn),
    ).toBe(false);
  });

  it('still delivers a refused sign-in, which names no account to filter on', () => {
    expect(subscriptionWants(asking(['auth.failed'], { accounts: ['account-2'] }), aRefusal)).toBe(
      true,
    );
  });

  it('does not let an account filter decide anything about a disk filling up', () => {
    expect(subscriptionWants(asking(['job.failed'], { accounts: ['account-2'] }), aFailure)).toBe(
      true,
    );
  });
});

describe('subscriptionWants, filtering by profile', () => {
  it('delivers a viewing by a profile that was named', () => {
    expect(
      subscriptionWants(asking(['playback.started'], { profiles: ['profile-1'] }), aViewing()),
    ).toBe(true);
  });

  it('holds back a viewing by a profile that was not named', () => {
    expect(
      subscriptionWants(asking(['playback.started'], { profiles: ['profile-2'] }), aViewing()),
    ).toBe(false);
  });

  it('still delivers a viewing through a share link, which is watched by no profile', () => {
    expect(
      subscriptionWants(
        asking(['playback.started'], { profiles: ['profile-2'] }),
        aViewing({ profileId: null, accountId: null }),
      ),
    ).toBe(true);
  });
});

describe('subscriptionWants, filtering by what kind of thing it is', () => {
  it('delivers an arrival of a kind that was named', () => {
    expect(
      subscriptionWants(
        asking(['media.added'], { mediaAdded: 'perItem', itemTypes: ['movie'] }),
        anArrival,
      ),
    ).toBe(true);
  });

  it('holds back an arrival of a kind that was not named', () => {
    expect(
      subscriptionWants(
        asking(['media.added'], { mediaAdded: 'perItem', itemTypes: ['episode'] }),
        anArrival,
      ),
    ).toBe(false);
  });

  it('admits a book, which is not a media item but is still a kind somebody filters on', () => {
    expect(
      subscriptionWants(asking(['media.removed'], { itemTypes: ['book'] }), {
        event: 'media.removed',
        data: { ...anItem, kind: 'book' },
      }),
    ).toBe(true);
  });

  it('filters a viewing by the kind of thing being watched', () => {
    expect(
      subscriptionWants(asking(['playback.started'], { itemTypes: ['episode'] }), aViewing()),
    ).toBe(false);
  });
});

describe('subscriptionWants, the mistake that would stop every delivery', () => {
  it('never treats a filter that does not apply as a filter that matched nothing', () => {
    const everyFilterSet = asking(['job.failed', 'auth.failed', 'library.scanned'], {
      accounts: ['account-9'],
      profiles: ['profile-9'],
      itemTypes: ['season'],
    });

    expect(subscriptionWants(everyFilterSet, aFailure)).toBe(true);
    expect(subscriptionWants(everyFilterSet, aRefusal)).toBe(true);
    expect(
      subscriptionWants(everyFilterSet, {
        event: 'library.scanned',
        data: {
          libraries: [
            {
              libraryId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
              libraryName: 'Films',
              added: 1,
              updated: 0,
              removed: 0,
              failed: 0,
              arrived: ['Dune'],
              arrivedNotListed: 0,
            },
          ],
          added: 1,
          updated: 0,
          removed: 0,
          failed: 0,
        },
      }),
    ).toBe(true);
  });

  it('applies every filter together, so one of them saying no is enough', () => {
    expect(
      subscriptionWants(
        asking(['playback.started'], { accounts: ['account-1'], itemTypes: ['episode'] }),
        aViewing(),
      ),
    ).toBe(false);
  });
});
