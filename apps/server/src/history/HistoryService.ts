/**
 * One thing somebody watched, once.
 */
type Viewing = {
  id: string;
  mediaItemId: string;
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
};

export type { HistoryService, Viewing };
