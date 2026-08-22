# ADR-0027: Keep books in tables of their own

- **Status:** Proposed
- **Date:** 2026-08-20
- **Deciders:** Marques Scripps
- **Supersedes:** —
- **Superseded by:** —

## Context

Valence reads one medium. `media_item` says so in its columns: `durationSeconds`,
`videoCodec`, `videoRange`, `width`, `height`, `audioStreams` and
`subtitleStreams` are all `NOT NULL`, and the only way the scanner learns
anything about a file is to hand it to FFmpeg and read the probe back.

`library.kind` has allowed `'music'` since libraries were added and nothing has
ever implemented it, so there is no precedent here to follow — manga and ebooks
are the first medium in Valence that is genuinely not video.

Almost nothing carries over. A book has no duration, no codec, and no streams. A
chapter of a manga has a page count instead, and an EPUB has neither: it has
documents that reflow to whatever they are shown in, so it has no pages at all
until somebody's screen decides how many there are. FFmpeg reads none of these
formats, so probing has nothing to say about any of them.

What does carry over is everything around the file — libraries, scanning by size
and modification time, artwork, metadata from a catalogue, per-profile progress,
favourites and history.

## Decision

**A book is not a media item.** Manga and ebooks live in `book`,
`book_chapter` and `reading_progress`. Nothing about them is stored in
`media_item`, and no column is added to `media_item` on their behalf.

**One `books` library kind, and each book records its own layout.** `book.layout`
is `fixed` for anything paginated ahead of time — CBZ, CBR, PDF — and `reflow`
for anything that lays itself out against a screen, which today means EPUB. The
kind decides how a library is scanned; the layout decides which reader opens.

**A folder is a series and each file inside it a chapter**, numbered from its
filename. A loose file with no folder around it is a book of one chapter.

**Reading position is its own table.** `reading_progress` holds `pageNumber` for
a fixed page and `fraction` for a place in reflowing text. `watch_progress`
records seconds against a `mediaItemId` and neither applies.

**Extraction stays in TypeScript, in the server process.** `fflate` for zip
containers, `node-unrar-js` for RAR, `mupdf` for rasterising PDF pages — WASM or
pure JavaScript, no native build. The Rust transcoder is not involved.

**Every fixed page reaches the reader as an image, and no reflowing document
ever becomes one.** The server unpacks, rasterises and sanitises; a reader
renders one of exactly two things.

## Consequences

### What this gets us

`media_item` keeps meaning what it says. Its `NOT NULL` columns stay honest, and
nobody reading it later has to wonder which rows have a real `videoCodec` and
which carry a placeholder because a comic had to be stored somewhere.

Scanning a books library cannot accidentally probe, because it does not have a
transcoder to probe with.

The two readers stay separable. A change to how manga spreads are offset cannot
break how a novel reflows, because they share a shell and nothing else.

Adding a further medium later — a magazine, a score, audiobooks — is a table and
a scan rather than an argument about what `durationSeconds` should be for it.

### What this costs us

**Everything that hangs off `media_item` has to learn about books, or not have
them.** Favourites, history, ratings, search, recommendations and sharing all key
on `mediaItemId`. Until each is widened, a book cannot be favourited, rated,
searched or shared. That is real, and it is the price of not lying in the schema.

**Two of several things.** Two scanners, two progress tables, two shapes in the
API. Some of it will look like duplication and some of it will be duplication
until a third medium shows what actually generalises.

**Three dependencies, one of them WASM-heavy.** `mupdf` is not small, and it is
loaded by the server process rather than an isolated worker.

**Sanitising is now our problem.** An EPUB is arbitrary XHTML written by a
stranger and served from the same origin as somebody's library. Getting that
wrong is a scripting hole, and it is a hole we opened.

### What this forecloses

A single unified `content` table across every medium, without a migration that
moves every existing row.

Reusing the transcoder's session and segment machinery for paginated formats —
progressive delivery of a large PDF, say — without wiring a second path into it.

## Alternatives considered

**Columns on `media_item`, nullable.** Every video column becomes nullable to
admit rows that have no codec, and every query that reads them learns to check.
It buys reuse of favourites and history immediately, and pays with a table that
no longer describes anything in particular.

**A `content` table with per-medium detail tables.** Correct, and the shape this
would grow into with a third medium. Rejected as premature: it would mean
migrating every `media_item` row now to serve one medium that does not exist yet.

**Extraction in the Rust transcoder.** The natural home for turning a file into
images, except FFmpeg reads none of these formats, so it means new crates and a
new FFI surface for work that is not on the playback path and has no realtime
constraint.

**`epub.js` in the browser.** It would own the layout we most want control of,
it is barely maintained, and it puts sanitising of a stranger's XHTML in the page
rather than on the server.

## Revisit when

A third non-video medium arrives, which is the point at which the shared shape
becomes visible and `content` may be worth the migration.

A books library grows past the point where scanning by unpacking is fast enough,
or where the page cache costs more disk than the library it serves.

An EPUB is found that the hand-written spine reader cannot open, and the
maintained alternative has become good enough to be worth its costs.
