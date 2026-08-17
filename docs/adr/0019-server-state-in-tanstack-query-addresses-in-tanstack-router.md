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

**The router owns the address and the history.** `buildRouter` declares every
address Flux serves and validates what each carries through one Zod schema,
`readSearch`. `usePlace` reads the router's history and turns it into the
`Place` the application reasons in; nothing touches `window.location` or
`history.pushState` directly.

**Every branch of the shell is a route, in three layers.** The layers exist
because three things have different lifetimes:

- the **root** decides whether this server has been set up at all;
- inside it, everything but a share link sits behind **the way in**, which is
  also where what the pages share is held — who is watching, what has been seen,
  how far through it they are, and the watch party;
- inside that, the **chrome** holds the dock, the bell and the dialogs, and the
  sections are its children.

So moving between sections changes the page and leaves the chrome, the dialogs
and anything playing alone, which is what the old ternary achieved by never
unmounting anything.

**A page reads what it shares from the layer above it, and everything else from
the cache.** `useShell` gives a page the handful of things a cache cannot answer
— what this tab has seen, what the player has reported this minute, the party.
Favourites, ratings, progress, libraries and notifications are queries, so a
page asks for them itself rather than being handed them.

**Every page but the home page is loaded when it is first asked for**, and each
route match is its own error boundary.

**Tests mount what the thing under test needs.** `renderInACache` and
`renderHookInACache` give a component a fresh cache and router; `renderInAShell`
adds a shell for a page; `renderTheApp` mounts the whole router, which is the
only honest way to test a layout that renders an outlet.

## Consequences

### What this gets us

The main bundle drops from 1.54 MB to 558 kB. An account that never opens the
admin page never downloads its 453 kB, and nothing downloads the player or Shaka
until something is played.

A page that throws draws its own apology instead of taking the application with
it, because each route match is its own error boundary. The browser puts the
scroll back where it was, rather than `scrollToTopOf` being called by hand.

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

Tests see two more asynchronous hops before anything renders: a query resolves
through the cache rather than through a promise the component awaited, and the
router loads its first match before drawing anything. Several suites needed an
extra flush, a few synchronous assertions became `findBy`, and a test that fired
a socket event immediately after rendering now waits for the listener first.

A page is now three files rather than a branch in one: the page, its test, and
whatever it reads from the shell. That is more files for the same behaviour, and
worth it only because the branch it replaced was one of six in a thousand-line
component.

### What this forecloses

Reading server state anywhere other than through a query module. A component
that calls a `fetch*` function directly reintroduces exactly the duplication
this removes, and there is no lint rule that catches it — only review.

Holding cross-page state anywhere other than the way-in layer. `useShell` is
deliberately small and every addition to it is state that could not be a query;
a page that wants to share something with another page should ask whether the
cache can answer it first.

Route loaders are available and not used. A loader fetches before the route
renders, which is the right shape for a page whose whole content is one query —
but Flux's pages compose several, and the cache already shows the last answer
while it checks. The gain would be smaller than the coupling.

## Alternatives considered

**Leave the fetching where it is and share through React context.** A context
holding fetched data is a cache with no keys, no staleness and no invalidation —
which is what `rememberedLibrary` already was, and why it was replaced.

**Adopt TanStack Query and leave the address alone.** The address is the other
half of the same problem: the shell was reading `window.location` and parsing it
by hand for the same reason components were fetching by hand. Doing one and not
the other leaves the codebase with two answers to "where does state live".

**Keep polling instead of invalidating from the socket.** The socket already
carries the news; a timer that guesses is strictly worse than being told, and
Flux already pays for the connection.

**Keep the sections in one component and lazily import them by hand.** That
would have bought the code splitting without the route tree, and left the
address, the history and the error boundaries where they were — three of the
four reasons for doing this at all.

## Revisit when

`Place` is the last hand-rolled piece: it is a shape the application invented,
mapped to and from the address by `readLocation` and `writeLocation`. Now that
every section is a route, it could give way to the router's own typed params and
search, which would make `go({ section: 'shows' })` a typed navigation rather
than a partial object that would accept a typo.

A page grows content that is one query deep and slow to arrive — that is the
case a route loader is for.

A screen needs data the cache should not hold: anything per-keystroke, anything
enormous, or anything the server expects to be read exactly once.
