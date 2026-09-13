# Contributing to Valence

Thanks for considering a contribution. This document covers process. The coding
rules themselves live in [`CODING_STANDARD.md`](CODING_STANDARD.md) and
are binding — please read them before opening a pull request, because most
review friction comes from rules that are easy to follow and easy to miss.

## Before you start

For anything beyond a small fix, open an issue first. This is not bureaucracy:
several areas of the codebase are more constrained than they look, and it is far
better to learn that a plugin API needs a new extension point before you have
written a workaround than after.

**If you need something the plugin broker does not expose, say so.** Extension
point requests are a first-class issue type with a fast path, deliberately, so
that the brokered plugin model does not become a wall.

## Setup

```bash
pnpm install
docker compose -f compose.dev.yaml up -d db  # Postgres
pnpm ffmpeg:sync         # Valence's own FFmpeg
pnpm dev
```

`pnpm ffmpeg:sync` fetches the build the shipped image carries — the version
pinned in the `Dockerfile`, so it is the same one — and points your `.env` at
it. It never overwrites `VALENCE_FFMPEG` or `VALENCE_FFPROBE` if you have set them
somewhere deliberate.

Skipping it is not fatal and is worse than it looks. The media service falls
back to whatever `ffmpeg` is on `PATH`, and Homebrew's build has no
`overlay_videotoolbox` and no `tonemap_videotoolbox` — so on a Mac, subtitles
and HDR quietly leave the hardware and nothing says so. A machine with no
`ffmpeg` at all reports every capability as absent, which reads exactly like
hardware that cannot do anything.

Running Valence in the container instead? Nothing to do — the image installs the
same build itself.

Adding a ValenceUI component? Add its alias line to `tsconfig.paths.json` — see
[`CODING_STANDARD.md`](CODING_STANDARD.md) section 3 for why the map is
explicit rather than wildcarded.

Working on the web client only? You can skip the Rust toolchain — use
`pnpm dev --filter=web...`.

Working on the media pipeline? You will need fixtures:

```bash
pnpm fixtures:sync --tier 1
```

Tests requiring an absent tier skip with a message naming the command; they
never silently pass.

## The rules in brief

Full detail in the standards document. The ones that most often surprise people:

- **TypeScript and Rust only.** Config files included.
- **No comments**, other than TSDoc on functions, Rust doc comments, `// SAFETY:`
  on `unsafe` blocks, and lint directives with a reason. If code needs
  explaining, improve the name or the type. If work is outstanding, open an
  issue — not a `TODO`.
- **No `index.ts` barrels**, no `../` imports.
- **No `any`, `unknown`, or `as`.** Untrusted data enters through a Zod schema.
- **No raw `<button>`, `<input>`, `<svg>`** and friends outside `packages/ui`.
  Icons come from Hugeicons' free stroke set, drawn through `@ValenceUI/Icon`.
- **Every function and component ships with a co-located test.**

Where these map onto lint rules they are enforced by oxlint, ESLint and husky.
The rest are upheld in review against
[`CODING_STANDARD.md`](CODING_STANDARD.md), which is the reference a
review comment will cite.

**Do not use `--no-verify` to get around a failing hook.** CI runs the same
checks, so it only delays the failure. If a lint rule is wrong, say so in an
issue.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), enforced at
`commit-msg`:

```
feat(transcoder): preserve HDR10 metadata through transcode
fix(ui): correct MediaCard focus ring in dark theme
docs(server): say how the data layer handles more than one node
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`,
`ci`, `style`, `revert`.

Scopes: `web`, `server`, `transcoder`, `desktop`, `ui`, `contracts`, `core`,
`plugin-sdk`, `auth`, `docs`, `deps`, `repo`. A change spanning several layers
takes no scope rather than an invented one.

Changes to the API contract or a plugin extension point **must** be marked
breaking with `!` and a `BREAKING CHANGE:` footer when they are. Both are public
surfaces with support windows.

## Branches

`type/short-description`, with the same types commits carry, lower case and
hyphenated:

```
feat/hide-a-library-per-profile
fix/a-stop-that-ends-one-viewing
docs/say-how-releases-are-cut
```

A branch and the commits on it describe the same piece of work, so they use one
vocabulary rather than two. Names say what the work is, never who is doing it:
`marques/the-thing` tells a reader nothing they can act on.

This is enforced in both directions. `pnpm branch:check` runs on `pre-push`, and
a repository ruleset applies the same rule on GitHub, so `--no-verify` does not
get a badly named branch onto the remote. Bots name their own branches and are
left alone.

## Pull requests

- One logical change per PR.
- Fill in the template, including what you tested and on what hardware — for
  media pipeline work, GPU vendor and driver version matter enormously.
- Update documentation in the same PR. Docs live in the repo precisely so this
  is possible.

## Test media

**Only freely redistributable media may be added as a fixture.** Clips from
commercial films are not redistributable at any length, regardless of intent.
Every fixture records its licence in `fixtures.manifest.json`, and a PR adding
one without a licence field will be rejected. This is a legal constraint on the
project, not a preference.

## Reporting a security issue

Do not open a public issue. See `SECURITY.md`.

Plugin sandbox escapes — anything letting plugin code reach the filesystem,
network, or session data outside its granted capabilities — are treated as
critical. The broker is a security boundary, and we would very much like to hear
about holes in it.
