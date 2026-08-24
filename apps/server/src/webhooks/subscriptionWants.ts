import type { WebhookOccurrence } from '@ValenceServer/events/EventBus';
import type { MediaKind } from '@ValenceContracts/schemas/MediaKind';
import type { WebhookEvent, WebhookFilters } from '@ValenceContracts/schemas/Webhook';

type SubscriptionInterest = {
  events: WebhookEvent[];
  filters: WebhookFilters;
};

/**
 * Applies one allowlist to one value.
 *
 * An empty list means everything, which is what a subscription that has chosen nothing gets. A value
 * of `null` means the filter does not apply to this event at all — a failed sign-in names no account,
 * a share link is watched by no profile — and that must pass rather than match nothing. Reading it
 * the other way round is the worst thing this file could do: nothing errors, and every delivery
 * quietly stops.
 *
 * @param allowed - What was asked for, empty meaning everything.
 * @param value - What this event carries, or null where it carries none.
 * @returns Whether the event survives this filter.
 */
const admits = <TValue extends string>(allowed: readonly TValue[], value: TValue | null): boolean =>
  allowed.length === 0 || value === null || allowed.includes(value);

/**
 * Names the account an occurrence is about, where it is about one.
 *
 * @param occurrence - What happened.
 * @returns The account id, or null where this event names no account.
 */
const accountOf = (occurrence: WebhookOccurrence): string | null =>
  'accountId' in occurrence.data ? occurrence.data.accountId : null;

/**
 * Names the profile an occurrence is about, where it is about one.
 *
 * @param occurrence - What happened.
 * @returns The profile id, or null where nobody's profile did this.
 */
const profileOf = (occurrence: WebhookOccurrence): string | null =>
  occurrence.event === 'playback.started' || occurrence.event === 'playback.stopped'
    ? occurrence.data.profileId
    : null;

/**
 * Names the kind of thing an occurrence is about, where it is about one.
 *
 * Asked by event rather than by looking for a `kind` field, because a job payload carries one too —
 * `job.completed` reports the kind of job — and reading that as though it named a film would filter
 * job events against a list of media kinds that can never match.
 *
 * @param occurrence - What happened.
 * @returns The kind, or null where this event is about no one item.
 */
const kindOf = (occurrence: WebhookOccurrence): MediaKind | null => {
  if (occurrence.event === 'media.added' || occurrence.event === 'media.removed') {
    return occurrence.data.kind;
  }

  if (occurrence.event === 'playback.started' || occurrence.event === 'playback.stopped') {
    return occurrence.data.item.kind;
  }

  return null;
};

/**
 * Decides whether one subscription wants one thing that happened.
 *
 * Asked at publish, before anything is queued, so that an event nobody wanted costs no queue row, no
 * delivery row and no history entry. Both stores ask this rather than deciding for themselves,
 * because two implementations of the same judgement drift and the drift is invisible — deliveries
 * simply stop, which looks exactly like nothing having happened.
 *
 * @param subscription - What this subscriber asked for.
 * @param occurrence - What happened.
 * @returns Whether it should be delivered.
 */
const subscriptionWants = (
  subscription: SubscriptionInterest,
  occurrence: WebhookOccurrence,
): boolean => {
  if (!subscription.events.includes(occurrence.event)) {
    return false;
  }

  if (occurrence.event === 'media.added' && subscription.filters.mediaAdded !== 'perItem') {
    return false;
  }

  return (
    admits(subscription.filters.accounts, accountOf(occurrence)) &&
    admits(subscription.filters.profiles, profileOf(occurrence)) &&
    admits(subscription.filters.itemTypes, kindOf(occurrence))
  );
};

export type { SubscriptionInterest };

export { subscriptionWants };
