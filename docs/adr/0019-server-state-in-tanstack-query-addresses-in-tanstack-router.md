# ADR-0019: Hold server state in TanStack Query and the address in TanStack Router

- **Status:** Accepted
- **Date:** 2026-08-17
- **Deciders:** Marques Scripps
- **Supersedes:** —
- **Superseded by:** —

## Context

Every screen in the web client fetched for itself. A component mounted, ran an
effect, called a `fetch*` function, put the answer in `useState`, and threw it
away on unmount. Forty-odd components did this, and it had four consequences
that had each been worked around separately rather than fixed.

**The same answer was read many times.** Resting on a card read the item;
opening its dialog read the same item again; pressing play read it a third time;
the hero read it a fourth. The home page and the browse page each read every
library and merged the pages themselves. The accounts panel and the roles panel
each read the permission catalogue.

**Leaving a page threw away everything it knew.** Going from the home page to a
film and back re-read the whole library, so the page flashed empty and the hero
picked something different to feature. That had been patched with a hand-rolled
module-level cache (`rememberedLibrary`) which held the last library and the
hero's sample — a cache with no invalidation, no keys and no eviction, which
also survived between tests and had to be cleared in a teardown hook.

**Anything shared had to be threaded through the root.** The root component read
the session, the setup status, the notifications, the push settings, the watch
progress, the library kinds and the profiles, then passed each down with a
`refresh` callback beside it so that a screen five levels down could ask for a
reread. Reporting progress meant calling a callback that called a fetch that set
state at the top.

**Two screens could hold different answers to the same question.** The library
browser drew progress bars from its own copy of the watch list while the root
held another, and they disagreed after anything was watched.

The address had the same shape of problem in a smaller space. `usePlace` read
`window.location`, parsed it by hand, wrote it back with `history.pushState`,
and listened for `popstate` itself. Query parameters were read with
`searchParams.get` and coerced ad hoc — `?person=banana` was handled by a
bespoke integer check written for that one parameter.

Both TanStack libraries were already dependencies; neither was used.

## Decision

**Server state lives in TanStack Query, declared in one place per subject.**
`apps/web/src/query/` holds `sessionQueries`, `libraryQueries`, `viewingQueries`,
`adminQueries` and `notificationQueries`. Each exports one object of
`queryOptions` factories and a `key` for its root. A component asks by calling
one of them; it does not construct a query key, and it does not call a `fetch*`
function in an effect.

**A component reads with `useQuery` and never copies the answer into state.**
Loading and failure come from the query — `isPending`, `isError` — rather than
from a `useState` flag beside it. Where a value must be shown before the server
has confirmed it, the change is written into the cache with `setQueryData` and
put back the same way if the server refuses, rather than held in a parallel copy.

**Changing something invalidates the key it changed.** No component rereads a
list after writing to it; it invalidates and lets everything reading that key
catch up. `useFreshFromTheSocket` does the same from the other side: the socket
already says when the media, the notifications, the profiles or the sessions
changed, so being told replaces polling, and a reconnection invalidates
everything because a sleeping tab missed whatever happened.

**The router owns the address and the history.** `buildRouter` declares the
addresses Flux serves — `/`, `/watch/$mediaId`, `/share/$token`,
`/media/$mediaId`, and a splat for the sections — and validates what each
carries through one Zod schema, `readSearch`. `usePlace` reads the router's
history and turns it into the `Place` the shell reasons in; nothing touches
`window.location` or `history.pushState` directly.

**Every address draws the same shell.** The route tree says which addresses are
real; it does not decide what is drawn. Flux is one screen with a player and a
stack of dialogs over it, and moving from the films page to something playing
must not tear the player down and build it again.

**Tests mount both.** `renderInACache` and `renderHookInACache` wrap what is
being tested in `CacheScope`, which holds a fresh cache and a router per render
so that no test is answered from what an earlier test asked for.

## Consequences

### What this gets us

Resting on a card is what makes its dialog open with the text already there,
because they are the same key. Leaving a page and coming back shows what was
there while it checks, so `rememberedLibrary` and its teardown hook are gone.
Progress is one answer that every rail, dialog and hero reads, so they cannot
disagree. The admin page's seven reads carry their own failure, so the "some of
this could not be read" banner is derived rather than tracked in a `Set` that
each read had to add itself to and remove itself from. The history panel keeps
the pages somebody asked for across a trip to a film and back.

`?person=banana` opens no dialog because one schema says what a search means,
rather than because somebody wrote a check for that parameter.

### What this costs us

Two more libraries in the critical path, and their idioms to learn: the
difference between `isPending` and `isLoading` for a disabled query is not
obvious, and got the empty-library state wrong once before it got it right.

Optimistic writes are now cache writes, which means a read in flight has to be
called off (`cancelQueries`) or it lands after the write and undoes it. That is
a rule to remember at each such site rather than something the types enforce.

Tests see one more asynchronous hop before anything renders, because a query
resolves through the cache rather than through a promise the component awaited.
Several suites needed an extra flush; a few synchronous assertions became
`findBy`.

### What this forecloses

Reading server state anywhere other than through a query module. A component
that calls a `fetch*` function directly reintroduces exactly the duplication
this removes, and there is no lint rule that catches it — only review.

Route-level loaders, prefetching on hover through the router, and per-route code
splitting are all available and none are used, because the shell draws every
address. Taking them up means splitting the shell into route components first,
which is a larger change than this one and should be its own decision.

## Alternatives considered

**Leave the fetching where it is and share through React context.** A context
holding fetched data is a cache with no keys, no staleness and no invalidation —
which is what `rememberedLibrary` already was, and why it was replaced.

**Adopt TanStack Query and leave the address alone.** The address is the other
half of the same problem: the shell was reading `window.location` and parsing it
by hand for the same reason components were fetching by hand. Doing one and not
the other leaves the codebase with two answers to "where does state live".

**Split the shell into route components.** The honest route-per-page migration
means taking a thousand-line shell holding the player, the watch party and six
dialogs and dividing it across routes. That is a rewrite of the application's
structure, not a migration of its routing, and it would have landed on top of an
already large change with no tests written for the new arrangement.

**Keep polling instead of invalidating from the socket.** The socket already
carries the news; a timer that guesses is strictly worse than being told, and
Flux already pays for the connection.

## Revisit when

The shell is split into route components — at that point route loaders and
per-route prefetching become worth having, and `usePlace` should give way to the
router's own typed params.

A screen needs data the cache should not hold: anything per-keystroke, anything
enormous, or anything the server expects to be read exactly once.
