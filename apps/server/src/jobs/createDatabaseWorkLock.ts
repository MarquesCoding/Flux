type LockAnswer = { locked: boolean };

type LockSession = {
  query: (text: string, values: (string | number)[]) => Promise<{ rows: LockAnswer[] }>;
  on: (event: 'error', listener: () => void) => void;
};

type LockSessions = {
  connect: () => Promise<LockSession>;
};

type Attempted<T> = { held: false } | { held: true; result: T };

type DatabaseWorkLock = {
  attempt: <T>(key: string, work: () => Promise<T>) => Promise<Attempted<T>>;
};

type CreateDatabaseWorkLockOptions = {
  sessions: LockSessions;
};

const VALENCE_LIBRARY_WORK = 0x56414c45;

const TAKE = 'select pg_try_advisory_lock($1, hashtext($2)) as locked';

const RELEASE = 'select pg_advisory_unlock($1, hashtext($2)) as locked';

/**
 * A lock on a library that every Valence process against one Postgres can see, so that two of them
 * do not do the same work at the same time.
 *
 * The lock inside the process is a map in memory, which guards the process holding it and nothing
 * else. One server is all there has ever been, so that has been enough — but an outgoing and an
 * incoming process overlap for a few seconds during a restart, and a scan runs for minutes, so a
 * redeploy can genuinely catch one mid-flight and the new process would start it again.
 *
 * Postgres advisory locks are the answer that needs no new infrastructure: the queue is already in
 * this database, the lock is a number rather than a table, and Postgres drops it by itself when the
 * connection holding it dies. That last part is what a lease table gets wrong — it has to guess an
 * expiry, and guessing short cuts off a live job while guessing long blocks the library after a
 * crash.
 *
 * Asking is `pg_try_advisory_lock` rather than `pg_advisory_lock`, because waiting would hold the
 * connection for as long as the other process works and there are only so many connections. A
 * caller told the lock is held elsewhere puts its job back with a delay instead.
 *
 * Every lock is taken on one connection kept for the purpose rather than one checked out per job.
 * An advisory lock belongs to the session that took it, so the taking and the releasing have to
 * happen on the same connection, and checking one out for the length of a job would mean six of
 * them held for minutes while a library is worked through — most of a default pool, taken from the
 * requests that need it. One session can hold as many of these locks at once as it likes.
 *
 * It follows that the lock in the process has to be taken first. A session that asks for a key it
 * already holds is given it a second time, so what keeps this honest within one process is the
 * cheaper lock, which lets only one job per key get this far.
 *
 * @param options - Where to get the connection the locks are taken on.
 * @returns The lock.
 */
const createDatabaseWorkLock = ({ sessions }: CreateDatabaseWorkLockOptions): DatabaseWorkLock => {
  let session: Promise<LockSession> | null = null;

  const sessionNow = (): Promise<LockSession> => {
    if (session === null) {
      const opening = sessions.connect().then((connected) => {
        connected.on('error', () => {
          if (session === opening) {
            session = null;
          }
        });

        return connected;
      });

      void opening.catch(() => {
        if (session === opening) {
          session = null;
        }
      });

      session = opening;
    }

    return session;
  };

  return {
    attempt: async (key, work) => {
      const connected = await sessionNow();
      const taken = await connected.query(TAKE, [VALENCE_LIBRARY_WORK, key]);

      if (taken.rows[0]?.locked !== true) {
        return { held: false };
      }

      try {
        return { held: true, result: await work() };
      } finally {
        await connected.query(RELEASE, [VALENCE_LIBRARY_WORK, key]).catch(() => null);
      }
    },
  };
};

export type { Attempted, DatabaseWorkLock, LockSession, LockSessions };

export { createDatabaseWorkLock };
