# ADR-0029: The server migrates its own database, and does not try to undo one

- **Status:** Proposed
- **Date:** 2026-08-24
- **Deciders:** Dan Morgan
- **Supersedes:** —
- **Superseded by:** —

## Context

[VAL-185](https://linear.app/valence-streaming/issue/VAL-185/fixserver-an-update-that-changes-the-schema-has-to-be-survivable-by-an)
exists because a release that changes the schema was not survivable by anybody
running the published image.

Valence detected that migrations were pending, said so, and carried on:

```
This database has not run 2 migrations the repository carries: … Reads of the
tables they change will fail until `pnpm --filter @valence/server db:migrate` is run.
```

The command in that message cannot be run where the message is printed.
`drizzle-kit` is a devDependency, and the runtime stage installs
`pnpm install --frozen-lockfile --prod --ignore-scripts`, so it is not in the
image. The migrations themselves _are_ — `COPY apps/server ./apps/server` brings
`apps/server/drizzle` along, which is why the journal could be read in order to
complain about it. The image had everything needed to migrate except a way to do
it.

What followed from that is on record four separate times in August:
`column "probeVersion" does not exist`, `column "videoLevel" does not exist`,
`relation "book" does not exist`. Each was recoverable only because it happened
on a machine with a checkout. A missing column breaks reads of the one table
that selects it and nothing else, so the server comes up, most of the API
answers, and the endpoints that do not look like they have a bug of their own.

## Decision

**The server applies pending migrations itself, at startup, before anything else
reads the database.**

`drizzle-orm/node-postgres/migrator` is already a production dependency and
applies the same journal `drizzle-kit migrate` does, so nothing is added to the
image.

**Migration completes before the job queue starts.** Not concurrently. The
startup fan-out enqueues a scan immediately, and a scan against a half-migrated
schema is precisely the failure above.

**A failure to migrate stops the server.** Coming up on a schema that half moved
is worse than not coming up, because it is the state that looks like a working
server with a few broken screens.

**Valence does not attempt to undo a migration, and does not take a dump before
applying one.** This is the part that deserves to be a decision rather than an
omission, because it is where the risk actually sits — most self-hosters will
have no backup.

Three reasons, in order of weight:

1. **A rollback that is not tested is not a rollback.** A down-migration for
   every change, exercised on every release, is a second migration path that
   would be run approximately never and would therefore be wrong when it
   mattered. Offering one is worse than declining to, because it converts "your
   database is behind" into "your database is in a state no version expects".
2. **A dump we cannot promise to complete is a false comfort.** `pg_dump` is not
   in the runtime image, the volume may not have room for a copy of the
   database, and a dump that fails halfway during startup would either block the
   server or be silently discarded. Both are worse than the operator knowing
   they are responsible for backups.
3. **The escape hatch costs nothing and covers the case.** An operator who wants
   to take their own dump first sets `MIGRATE_ON_START=false`, restarts, backs
   up, and runs the migration by hand.

**Every message about migrating names an action performable where it is
printed.** `MIGRATE_ON_START=false` with migrations pending logs an error naming
them and pointing at
`docker compose exec valence node apps/server/dist/Migrate.js`, which ships in
the image. Nothing in the server's output mentions `drizzle-kit` or
`db:migrate`, and there is a test asserting it.

## Consequences

**Update means pull and restart**, which is what this audience has been taught to
expect by every other self-hosted media server. Nobody has to know they signed up
to run a database.

**An operator can still drive it by hand**, and the way to do so exists inside
the container rather than in a checkout they do not have.

**A destructive migration will destroy data, and Valence will not stop it.** That
is the accepted cost. It is mitigated by the opt-out and by saying so plainly
here and in `.env.example`, not by machinery that would pretend to a safety it
could not deliver. A migration that drops a column somebody may want back should
be reviewed on that basis before it ships — the guard is the pull request, not
the runtime.

**This is safe to do unattended because of
[ADR-0006](0006-deployment-topology-single-box.md).** One box, one container,
one server: there is no second instance to race the same migration. Drizzle takes
a lock regardless. Under a topology that allowed several this would be a harder
argument, and this ADR would need revisiting rather than extending.
