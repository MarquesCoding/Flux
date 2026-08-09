# Flux Code Standards

These rules are binding. They are enforced by tooling wherever a rule can be
expressed as a lint rule, and by review where it cannot. A pull request that
violates a rule here does not merge, regardless of how good the change is
otherwise.

Where a rule has a known cost, that cost is stated. Rules are not folklore.

---

## 1. Languages

**TypeScript and Rust only. No JavaScript.**

This includes configuration. Build config, scripts, tooling, and lint config are
authored in TypeScript (`vite.config.ts`, `eslint.config.ts`, `scripts/*.ts`)
and executed via `tsx` where a runtime needs them. Where a tool physically
cannot load TypeScript config, the generated JavaScript is a build artifact and
is `.gitignore`d, never hand-edited.

No `.js`, `.jsx`, `.mjs`, or `.cjs` files are committed to the repository.

---

## 2. No duplication across modules

If a function, type, constant, or component is needed in more than one place, it
is extracted and shared. Copy-paste between `apps/`, `packages/`, or platforms is
not acceptable.

Where shared code lives:

| Shared between                           | Goes in                               |
| ---------------------------------------- | ------------------------------------- |
| Any two workspace members                | `packages/contracts` (types, schemas) |
| Any two UI surfaces                      | `packages/ui`                         |
| Server-only helpers used by two services | `packages/core`                       |
| Plugin-facing anything                   | `packages/plugin-sdk`                 |

The dependency rules in ADR-0001 still apply — extraction must not create a
cycle. If extracting would create one, the shared thing belongs further up the
graph, usually in `contracts`.

**Rust:** shared logic lives in a workspace crate, not duplicated between
binaries. Same principle, same enforcement.

---

## 3. Imports

**Relative parent imports are banned.** `../`, `../../`, and deeper never appear
in an import specifier.

```ts
import Button from '@FluxUI/Button' // correct
import Button from '../../ui/Button/Button' // banned
```

Same-directory relative imports (`./Button.types`) are permitted, because a
component importing its own co-located types is not crossing a boundary.

### Alias map

| Alias              | Resolves to                                    |
| ------------------ | ---------------------------------------------- |
| `@FluxUI/<Name>`   | `packages/ui/src/components/<Name>/<Name>.tsx` |
| `@FluxContracts/*` | `packages/contracts/src/*`                     |
| `@FluxCore/*`      | `packages/core/src/*`                          |
| `@FluxSDK/*`       | `packages/plugin-sdk/src/*`                    |

### How `@FluxUI/Button` resolves without index files

TypeScript path mapping substitutes a wildcard once, so `@FluxUI/*` cannot expand
to `components/*/*.tsx` — the captured segment would need to appear twice. Since
rule 4 also forbids barrel files, there is no `index.ts` to fall back on.

Component aliases are therefore **listed explicitly, one line per component**, in
`tsconfig.paths.json` at the repository root:

```json
{
  "@FluxUI/Button": ["./packages/ui/src/components/Button/Button.tsx"],
  "@FluxUI/Checkbox": ["./packages/ui/src/components/Checkbox/Checkbox.tsx"]
}
```

Adding a component means adding one line here. It is a one-line diff, visible in
review, and it keeps resolution explicit and greppable without reintroducing
barrels. The non-component packages keep ordinary wildcard aliases, which work
because their paths do not repeat a segment.

Vitest and Vite read these through `vite-tsconfig-paths`, so there is a single
source of truth rather than a duplicated alias list per bundler config.

### Published package names

`@FluxUI` is an internal alias only. npm scopes must be lowercase, so any package
published to a registry uses a lowercase name (`@flux/ui`, `@flux/plugin-sdk`).
The alias and the published name are deliberately different things; do not try to
make them match.

---

## 4. No index files

`index.ts` and `index.tsx` are not used to re-export functions or components
anywhere in the repository. Every module is imported from the file that defines
it.

This means no barrel files, no `export * from`, and no directory-level public
surface. It costs slightly longer import paths and buys precise dependency
graphs, faster type-checking, and no accidental circular imports through a
barrel.

---

## 5. Exports

**Every component and function file default-exports an object naming its
member:**

```tsx
const Button = (props: ButtonProps) => {
  return <BaseButton className={...}>{props.children}</BaseButton>
}

Button.displayName = 'Button'

export default { Button }
```

Consumption — **import the module, then destructure at the top of the file**:

```tsx
import ButtonModule from '@FluxUI/Button'

const { Button } = ButtonModule

const MediaCard = (props: MediaCardProps) => {
  return <Button variant="primary">Play</Button>
}
```

This is the house style and it is not optional. Using the module object inline
(`<ButtonModule.Button />`) works but reads badly and is inconsistent with the
rest of the codebase. Destructuring once at module scope keeps JSX identical to
a conventional named import.

Type-only exports (`export type { ButtonProps }`) are permitted alongside the
default export, because they are erased at runtime and are not members.

One exported runtime member per file. The file name matches the member name.

### Known costs of this rule, and required mitigations

This form was chosen deliberately. Its consequences are managed, not ignored.

**React DevTools.** A component inside an object literal has no inferred name.
`displayName` is therefore **mandatory** on every component and is lint-enforced.
With it set, DevTools displays correctly.

**`React.lazy`.** A lazy import cannot find a component default. Use the
`lazyFlux` helper in `@FluxUI/lazyFlux`, never `React.lazy` directly:

```ts
const Settings = lazyFlux(() => import('@FluxUI/Settings'), 'Settings')
```

**Vite Fast Refresh.** React Fast Refresh cannot track a component wrapped in an
object literal, so editing a component remounts its subtree and loses local state
instead of hot-patching in place. There is no mitigation. This is an accepted
cost of the export convention; do not file it as a bug.

**Tree-shaking.** Not materially affected. Because rule 4 forbids barrels and
each file exports exactly one member, there is nothing else in the module for a
bundler to eliminate.

---

## 6. Comments

**No comments in the codebase, with these exceptions:**

1. **TSDoc on functions and components.** Encouraged, and required on anything
   exported from `packages/plugin-sdk` or `packages/contracts`, because those
   generate public documentation (ADR-0003).
2. **Rust doc comments** (`///`, `//!`) on public items, for the same reason.
3. **`// SAFETY:` on every `unsafe` block in Rust.** This is required by
   `clippy::undocumented_unsafe_blocks`, which is enabled. A rule that fights the
   linter is a rule that gets disabled, so this exception exists by necessity.
4. **Lint suppression directives** (`// eslint-disable-next-line`,
   `#[allow(...)]`). These are instructions to tooling, not commentary. Each
   requires a reason string, and each is reviewed as a change in its own right.

Everything else — explanatory comments, section banners, commented-out code,
`TODO`, `FIXME` — is rejected. If code needs explanation, the explanation belongs
in a name, a type, or a TSDoc block. If work is outstanding, it belongs in an
issue where it can be tracked, not in a comment where it cannot.

---

## 7. Naming and file layout

**Files are PascalCase**, except type files and standalone function files.

| Kind                | Casing              | Example                  |
| ------------------- | ------------------- | ------------------------ |
| Component           | PascalCase          | `MediaCard.tsx`          |
| Component types     | PascalCase + suffix | `MediaCard.types.ts`     |
| Component test      | PascalCase + suffix | `MediaCard.test.tsx`     |
| Hook                | camelCase           | `usePlaybackSession.ts`  |
| Standalone function | camelCase           | `formatDuration.ts`      |
| Function test       | camelCase + suffix  | `formatDuration.test.ts` |
| Rust module         | snake_case          | `transcode_plan.rs`      |

A component's types live with the component, never in a shared types directory:

```
components/MediaCard/
  MediaCard.tsx
  MediaCard.types.ts
  MediaCard.test.tsx
  animations/
    fadeIn.tsx
  components/
    MediaCardBadge/
      MediaCardBadge.tsx
      MediaCardBadge.types.ts
      MediaCardBadge.test.tsx
```

Sub-components nest under the parent's `components/` directory to arbitrary
depth. A sub-component used by two different parents is not a sub-component — it
is promoted to a top-level component under rule 2.

Types shared across components live in `packages/contracts`.

---

## 8. Types

**`any`, `unknown`, and type assertions are all banned.**

`as` is included because banning `unknown` without banning `as` would push
untrusted data through unchecked casts, which is strictly less safe than the
thing being banned. The two rules only work together.

Permitted: `as const`, and `satisfies`.

### How to handle untrusted input without either

Untrusted data enters through a Zod schema, which produces a concrete type
without any annotation being written:

```ts
const item = MediaItemSchema.parse(JSON.parse(body))
```

`JSON.parse` returns `any`, but no `any` token appears in the source and the
result is runtime-validated before it is used. This is the required pattern for
every external boundary: HTTP bodies, plugin RPC payloads, file metadata,
transcoder output, and anything read from disk.

### Errors

Do not annotate the catch variable. TypeScript infers it, and `instanceof`
narrows it without a cast:

```ts
try {
  await startSession(plan)
} catch (error) {
  if (error instanceof TranscodeError) {
    return failure(error.code)
  }
  throw error
}
```

`useUnknownInCatchVariables` is enabled in `tsconfig`, alongside `strict`,
`noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`.

---

## 9. UI components

**Raw HTML form and interactive elements are banned in application code.** No
`<button>`, `<input>`, `<select>`, `<checkbox>`, `<textarea>`, `<a>` used as a
control, or `<dialog>`. Use the FluxUI equivalent.

FluxUI itself is the only place these primitives appear, because that is where
they are wrapped. See ADR-0013.

Structural elements — `<div>`, `<span>`, `<section>`, `<ul>` — are fine.

**If FluxUI lacks a component you need, add it to FluxUI.** Do not work around
its absence locally. A one-off raw control in an app is how design systems die.

---

## 10. Icons

**All icons come from `@tabler/icons-react`.**

**No raw SVG anywhere in the codebase.** No inline `<svg>` elements, no
`.svg` imported as a component, no SVG strings.

The sole exception is brand assets — logo, wordmark, favicon — which live as
files in `packages/ui/assets/brand/` and are referenced by URL, never inlined
into JSX. If Tabler lacks an icon you need, request it upstream or add it to the
brand assets directory as a considered decision, not inline in a component.

---

## 11. Animation

**Motion (`motion`, formerly `framer-motion`) is preferred over raw CSS
animations and transitions.** Declarative, interruptible, and testable beats
keyframes.

Placement:

| Scope                                    | Location                                       |
| ---------------------------------------- | ---------------------------------------------- |
| Used once, inside one component          | Inline in that component                       |
| Shared across files within one component | `components/ComponentName/animations/spin.tsx` |
| Shared across multiple components        | `packages/ui/animations/spin.tsx`              |

CSS transitions remain acceptable for trivial hover and focus states where
Motion would be overhead. Anything with orchestration, sequencing, layout
animation, enter/exit, or gesture response uses Motion.

**Respect `prefers-reduced-motion`.** Every shared animation exports a
reduced-motion variant, and the shared `useFluxMotion` hook selects between
them. This is not optional; it is an accessibility requirement.

---

## 12. Testing

**Every function and every component is tested. Vitest, co-located.**

```
components/MediaCard/MediaCard.test.tsx
functions/formatDuration.test.ts
```

- Components use Vitest + React Testing Library. Query by role and accessible
  name, not by test id or class. If a component is hard to query by role, that is
  usually an accessibility defect in the component, not a testing problem.
- Coverage thresholds are enforced in CI and are not lowered to make a build
  pass. Raising them is a PR of its own.
- Rust code is tested with `cargo test`. Negotiation logic in particular is
  tested as pure functions over data, per ADR-0011 — no media files, no FFmpeg.
- Tests that need media fixtures follow ADR-0012 and skip with an actionable
  message when the tier is absent. CI asserts the expected tiers were present.

---

## 13. Commits

**Conventional Commits, enforced by `commitlint` at the `commit-msg` hook.**

```
feat(transcoder): preserve HDR10 metadata through transcode
fix(ui): correct MediaCard focus ring in dark theme
chore(deps): pin better-auth to 1.4.2
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`,
`ci`, `style`, `revert`.

Scopes are workspace module names: `web`, `server`, `transcoder`, `ui`,
`contracts`, `plugin-sdk`, `docs`.

Breaking changes use `!` and a `BREAKING CHANGE:` footer. For anything affecting
the API contract (ADR-0002) or a plugin extension point (ADR-0007), this is
mandatory and drives the changelog.

---

## 14. Enforcement

See ADR-0014 for the full tooling decision. In summary: **oxlint** runs first for
speed and owns all non-type-aware rules; **ESLint** owns only rules requiring the
type checker; **husky** blocks anything non-conforming before it reaches the
remote.

Where a rule maps onto an existing lint rule, it is configured and enforced.
Rules with no upstream equivalent — no comments, no index files, export shape,
no raw elements, no SVG — are **documented here and upheld in review**. This
document is the reference; when a review comment cites a rule, it cites a section
number from this file.
