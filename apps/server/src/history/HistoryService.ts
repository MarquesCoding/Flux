/**
 * One thing somebody watched, once.
 */
type Viewing = {
  id: string;
  mediaItemId: string;
  /**
   * What was watched, as it should be read.
   *
   * Carried on the viewing rather than looked up by whoever draws it: a page
   * of fifty would otherwise be fifty more requests, and the answer is one
   * join away from where the rows already are.
   *
   * Answered by `list`, which is what a history is read through. Null from
   * `record`, whose caller has just said what was watched — and null in a
   * listing when the item has since left the library. The viewing survives
   * that; somebody did watch it, and there is simply nothing left to name it
   * with.
   */
  title: string | null;
  seriesTitle: string | null;
  startedAt: string;
  lastWatchedAt: string;
  secondsWatched: number;
  isFinished: boolean;
};

/**
 * A profile's viewing history.
 *
 * Append-mostly: a viewing is opened when somebody starts something and
 * extended while they stay with it, so one sitting is one row however many
 * times the player reports in. What decides which of those happens is
 * `decideViewing`, kept apart from here so the rules can be argued with
 * without reading a query.
 *
 * Per profile rather than per account, like progress. Who watched what is a
 * question about a person rather than about a login, and history is the more
 * personal of the two.
 */
type HistoryService = {
  /**
   * Notes that somebody watched some of something.
   *
   * Answers with the viewing it belongs to, or null when there was too little
   * of it to be worth remembering.
   */
  record: (
    profileId: string,
    mediaItemId: string,
    seen: { at: Date; secondsWatched: number; isFinished: boolean },
  ) => Promise<Viewing | null>;

  /**
   * What a profile has watched, most recent first.
   */
  list: (profileId: string, options?: { limit?: number; offset?: number }) => Promise<Viewing[]>;

  /**
   * Forgets one viewing.
   *
   * A viewer can remove their own history, which for a shared house is the
   * point of it being per profile: somebody who watched something they would
   * rather not have listed should not have to ask an administrator.
   */
  forget: (profileId: string, viewingId: string) => Promise<boolean>;

  /**
   * Forgets everything a profile has watched.
   */
  forgetAll: (profileId: string) => Promise<number>;

  /**
   * Forgets every viewing older than a date, whoever it belonged to.
   *
   * For the scheduled pruning. This log grows every evening a household
   * watches anything, and what is worth keeping is what is recent enough to be
   * read — usage figures that outlive the detail are rolled up separately
   * rather than recomputed from rows nobody will look at again.
   */
  prune: (before: Date) => Promise<number>;
};

export type { HistoryService, Viewing };
