# ADR-0014: Lint and commit enforcement with oxlint, ESLint and husky

- **Status:** Accepted
- **Date:** 2026-08-09

## Context

The code standards contain a number of rules that no off-the-shelf linter
implements: no comments except TSDoc, no index files, a specific export shape, no
raw interactive HTML elements, no raw SVG, and a ban on `unknown` and type
assertions alongside `any`.

There is a real tension here. Rules enforced only by review do decay — reviewers
are inconsistent, tired, and reluctant to block a good change over a naming
violation. But a bespoke lint plugin is real software with real maintenance, and
building ten custom rules before the first feature exists is a poor use of the
project's early effort.

We resolve it by scope: enforce mechanically what stock tooling already
expresses, and write the rest down clearly rather than building machinery for it.

Separately, ESLint with type-aware rules is slow on a monorepo of this size, and
slow feedback is feedback that gets bypassed with `--no-verify`.

## Decision

**Two linters with a strict division of responsibility, plus husky gates.**

### oxlint — first, fast, non-type-aware

Runs on every commit across all staged files. Owns everything that can be decided
from the syntax tree alone: unused variables, import correctness, obvious
correctness bugs, React hook rules, and the majority of the Flux custom rules.

### ESLint — second, slower, type-aware only

Configured with **only** rules that genuinely require the type checker:
`no-floating-promises`, `no-misused-promises`, `no-unnecessary-condition`,
`no-unsafe-*`, and the type-aware half of the Flux rules.

**No rule is implemented in both.** Duplication produces conflicting autofixes
and doubles the runtime for no benefit. If oxlint can decide it, oxlint owns it.

### Rules with no upstream equivalent

Several standards — no comments, no index files, the export shape, no raw
interactive elements, no raw SVG, `displayName` on every component — have no
off-the-shelf lint rule.

**These are documented in `docs/code-standards.md` and upheld in review. We do
not write a custom lint plugin for them.** A bespoke rule package is real
software with its own tests, its own maintenance against upstream AST changes,
and its own false positives that block work until someone fixes them. For a
project at this stage that cost is not worth paying, and the standards document
is a clearer reference for a contributor than a lint error message anyway.

What _can_ be expressed with stock configuration still is:

| Standard                    | Enforced by                                                 |
| --------------------------- | ----------------------------------------------------------- |
| No `any`                    | `typescript/no-explicit-any` (oxlint)                       |
| No `../` imports            | `no-restricted-imports` with a `../*` pattern               |
| No raw interactive elements | `react/forbid-elements`, scoped to exclude `packages/ui`    |
| No JavaScript files         | `.js`/`.jsx` in `.gitignore` plus a CI file-extension check |
| Conventional Commits        | `commitlint`                                                |
| Type soundness              | `tsc --noEmit`, `strict` plus `useUnknownInCatchVariables`  |

### Husky gates

| Hook         | Runs                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| `pre-commit` | `lint-staged`: oxlint (fix), ESLint on changed files, formatter, `tsc --noEmit` on affected projects |
| `commit-msg` | `commitlint` against Conventional Commits                                                            |
| `pre-push`   | `vitest run` for affected packages, `cargo clippy -- -D warnings`, `cargo test`, `cargo fmt --check` |

`tsc --noEmit` at pre-commit is deliberate. A ban on `any`, `unknown`, and
assertions is only meaningful if the type checker actually runs before code
lands; without it, unsound code merges and the ban is decoration.

### Rust

`rustfmt` with a committed `rustfmt.toml`. `clippy` at `-D warnings` with
`undocumented_unsafe_blocks` enabled — which is why `// SAFETY:` is a carve-out
in the comment rule. `unwrap()` and `expect()` are denied outside `#[cfg(test)]`.

### CI

CI re-runs everything the hooks run. Hooks are a fast local signal, not the
enforcement boundary — `--no-verify` exists, and CI is what actually gates merge.

## Consequences

### What this gets us

Standards that hold. New contributors learn the rules from immediate tool
feedback rather than from a review round trip, which is both faster and far less
demoralising than being told in a PR that thirty files need renaming.

### What this costs us

The standards without an upstream lint rule rely on review, and review-only
rules decay — reviewers are inconsistent and reluctant to block a good change
over a naming violation. We accept that decay as the price of not maintaining a
custom rule package. If a particular rule proves to be violated constantly, that
is the signal to reconsider for _that rule specifically_, not to build the whole
plugin up front.

Pre-commit is slower than a bare commit, and `tsc --noEmit` on a large monorepo
is the slow part. Incremental builds and project references mitigate but do not
eliminate this.

### What this forecloses

Quick unblocked commits when tooling misfires, without `--no-verify`. Since CI
enforces the same rules, that escape hatch is local convenience only, which is
the correct balance.

## Alternatives considered

**A custom ESLint rule package.** Rejected for the reasons above: a maintenance
burden disproportionate to the benefit at this stage, when a written standard
serves the same purpose for a contributor.

**Biome instead of oxlint + ESLint.** Genuinely appealing: one tool, formatter
included, very fast. Rejected for now because type-aware rules are the ones
catching the most dangerous defects and ESLint's coverage there is stronger.
Worth revisiting.

**ESLint alone.** Simpler, one config. Rejected on speed; type-aware ESLint
across this monorepo at pre-commit is slow enough that people would bypass it.

**oxlint alone.** Fast, but cannot express type-aware rules.

## Revisit when

- A specific documented standard is violated often enough to justify a rule for
  it on its own merits.
- oxlint gains type-aware analysis, at which point ESLint may be droppable.
- Pre-commit time exceeds roughly 10 seconds on a typical change.
