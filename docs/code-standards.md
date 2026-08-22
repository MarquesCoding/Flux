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
import Button from '@ValenceUI/Button'; // correct
import Button from '../../ui/Button/Button'; // banned
```

Same-directory relative imports (`./Button.types`) are permitted, because a
component importing its own co-located types is not crossing a boundary.

### Alias map

| Alias                 | Resolves to                                    |
| --------------------- | ---------------------------------------------- |
| `@ValenceUI/<Name>`   | `packages/ui/src/components/<Name>/<Name>.tsx` |
| `@ValenceContracts/*` | `packages/contracts/src/*`                     |
| `@ValenceCore/*`      | `packages/core/src/*`                          |
| `@ValenceSDK/*`       | `packages/plugin-sdk/src/*`                    |

### How `@ValenceUI/Button` resolves without index files

TypeScript path mapping substitutes a wildcard once, so `@ValenceUI/*` cannot expand
to `components/*/*.tsx` — the captured segment would need to appear twice. Since
rule 4 also forbids barrel files, there is no `index.ts` to fall back on.

Component aliases are therefore **listed explicitly, one line per component**, in
`tsconfig.paths.json` at the repository root:

```json
{
  "@ValenceUI/Button": ["./packages/ui/src/components/Button/Button.tsx"],
  "@ValenceUI/Checkbox": ["./packages/ui/src/components/Checkbox/Checkbox.tsx"]
}
```

Adding a component means adding one line here. It is a one-line diff, visible in
review, and it keeps resolution explicit and greppable without reintroducing
barrels. The non-component packages keep ordinary wildcard aliases, which work
because their paths do not repeat a segment.

Vitest and Vite read these through `vite-tsconfig-paths`, so there is a single
source of truth rather than a duplicated alias list per bundler config.

### Published package names

`@ValenceUI` is an internal alias only. npm scopes must be lowercase, so any package
published to a registry uses a lowercase name (`@valence/ui`, `@valence/plugin-sdk`).
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

**Every component and function file exports its members by name:**

```tsx
const Button = (props: ButtonProps) => {
  return <BaseButton className={...}>{props.children}</BaseButton>
}

Button.displayName = 'Button'

export { Button }
```

Consumption — **import what is used, and nothing else**:

```tsx
import { Button } from '@ValenceUI/Button';

const MediaCard = (props: MediaCardProps) => {
  return <Button variant="primary">Play</Button>;
};
```

No default exports, and no module objects. A file exports the thing it is named
after; a caller names the thing it needs. Nothing has to be unwrapped at the top
of a file before it can be used, and nothing has to be renamed to avoid a
collision between two modules called the same.

Type-only exports (`export type { ButtonProps }`) sit alongside the value
exports and are erased at runtime.

One exported runtime member per file, with the file named after it. Constants
that belong to that member — a delay, a limit, a list of options it is built
from — may be exported beside it where tests or callers genuinely need them.

### What this replaces

Until August 2026 every file default-exported an object naming its member, and
every caller imported the module and destructured it. That form was chosen to
make the exported surface explicit; in practice it cost more than it bought.

**What the change buys.** React Fast Refresh works again: a component inside an
object literal cannot be tracked, so every edit remounted the subtree and lost
local state — a player forgot its position on each keystroke. `React.lazy` works
directly, so the `lazyFlux` helper that existed only to unwrap a default is
gone. `displayName` remains required, but for its own sake rather than to repair
a name the convention had erased.

**What it costs.** A single sweeping change to every file in the repository,
which is a large diff and a bad day for anybody rebasing across it. That cost is
paid once.

This rule is enforced: `import/no-default-export` is on in oxlint, with an
exception for the config files that tooling insists on reading a default from.

### The tooling note that survives it

`apps/server/src/db/Schema.ts` exports each table by name because drizzle-kit
discovers tables by scanning a module's named exports; given anything else it
reports `0 tables` and generates an empty migration, silently. Under this rule
that file is no longer an exception — it is simply the rule applied.

---

## 6. Comments

**No comments in the codebase, with these exceptions:**

1. **TSDoc on functions and components — and on nothing else.** Required on
   anything exported from `packages/plugin-sdk` or `packages/contracts`, because
   those generate public documentation (ADR-0003).

   **One sentence saying what the function does.** Not why it was written that
   way, not what was tried before, not what the alternative would have cost. A
   summary, and then `@param` and `@returns` where the name and the type do not
   already say it — a `@param mediaId` on `(mediaId: string)` is the signature
   read aloud, and adds nothing.

   **Types, constants, properties and interfaces carry no TSDoc at all.** A
   type says what it is by being a type with a name; a constant says it by
   being named. If either needs a paragraph to be understood, the name is
   wrong, and renaming it fixes every place it is read rather than one.

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

### How this is enforced

Two checks, because no one linter reads every language here.

`flux/no-comments` in `tools/eslint/noComments.ts` covers TypeScript. It fails
on any comment that is not one of the exceptions above, and removes it under
`--fix`. TSDoc counts only when it sits on a function — a declaration, a method,
or a `const` holding an arrow function. On a type, a constant or a property it is
rejected, and a `/** */` block floating inside a function body is prose in a
costume and rejected as prose.
A third slash means `/// <reference>` and nothing else: `/// prose` is Rust
syntax in the wrong language, and is rejected too.

`tools/comments/checkComments.ts` covers Rust and CSS, which ESLint cannot see
at all. It parses rather than pattern-matches, so a `//` inside a string literal
stays where it is. Both run under `pnpm lint`, which runs on every commit.

The rule also fails a lint directive that does not say why, after `--`.

This is a rule that was written down and then ignored for a year, by people and
by coding agents alike. Documentation does not enforce itself; a failing build
does.

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
const item = MediaItemSchema.parse(JSON.parse(body));
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
  await startSession(plan);
} catch (error) {
  if (error instanceof TranscodeError) {
    return failure(error.code);
  }
  throw error;
}
```

`useUnknownInCatchVariables` is enabled in `tsconfig`, alongside `strict`,
`noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`.

---

## 9. UI components

**Raw HTML form and interactive elements are banned outside the one FluxUI
component that owns each of them.** No `<button>`, `<input>`, `<select>`,
`<textarea>`, `<a>` used as a control, or `<dialog>` — not in application code,
and not in other FluxUI components either.

Structural elements — `<div>`, `<span>`, `<section>`, `<ul>` — are fine.

### One component owns each primitive

| Primitive                                           | Owned by     | Everything else       |
| --------------------------------------------------- | ------------ | --------------------- |
| `<button>`                                          | `Button`     | composes `Button`     |
| `<input type="text\|email\|password\|url\|search">` | `TextField`  | composes `TextField`  |
| `<input type="file">`                               | `FilePicker` | composes `FilePicker` |
| `<dialog>`, focus trapping                          | `Dialog`     | composes `Dialog`     |

**A control that is not one of those is a shape of one of those.** An icon
button is `Button` with an icon and a label. A search box is `TextField` wearing
no box. A row of page markers, a bar of places, a menu of settings: all
`Button`, painted differently.

There is no `IconButton`, and there should be no equivalent of one for any other
primitive. A second component wrapping the same element is a second set of focus
behaviour, disabled behaviour and keyboard behaviour — written slightly
differently, drifting apart from the first, and each fixed separately when
either turns out to be wrong.

### Widening a component rather than escaping it

When a control needs something the owning component does not offer, **add it to
that component**. `Button` carries `variant="bare"` and `size="none"` for
exactly this: the controls FluxUI builds out of it need a button's behaviour and
none of its skin.

`bare` and `none` are for a control that supplies its own shape: a card that is
one big press target, an episode row, the clock in the player. They say _this
one is painted by its caller_ — not _this one is exempt_. A control that wants a
skin FluxUI does not have wants a variant that ought to exist by name; add it,
and say what it is for.

**If FluxUI lacks a component you need, add it to FluxUI.** A one-off raw
control in an app is how design systems die; a second component owning the same
element is how they rot.

### Base UI owns behaviour; FluxUI owns appearance

If Base UI ships a primitive for what you are building, build on it. Roles,
keyboard handling, focus management and ARIA wiring are a contract with the
browser and with assistive technology, and hand-rolling them produces something
that looks right and is subtly wrong — a `div` with a bar in it instead of a
meter, a button with `role="switch"` that a keyboard cannot toggle.

**Only `packages/ui` imports Base UI.** An app that imports it directly has
reached past the layer whose whole job is to be the one place a control is
decided. If FluxUI lacks the component, add it to FluxUI.

Judgement still applies. A primitive earns its place by doing something for you:
`Field` was worth adopting because it owns label, description, error and the
wiring between them. `FilePicker`'s `<label>` was not, because there the label
_is_ the mechanism that opens the file browser, and wrapping it in a `Field.Root`
would add a DOM node to satisfy a library rather than a reader.

### A look is a variant, not a class at the call site

`className` on a FluxUI component is for _where a thing sits_ — width, margin,
grid placement. It is not for what the thing looks like.

Four call sites once wrote `className="bg-black/50 text-white backdrop-blur"` on
a `Button`. That is one look, described four times, in raw colours no theme can
reach. It is now `variant="overlay"`, painted from `--color-scrim` and
`--color-on-scrim`.

When a control needs a look the component does not offer:

1. Name the look — what is it _for_, not what colour is it. `overlay` is for a
   control on artwork; `link` is text that leads somewhere.
2. Add it to the component's variant list, in tokens rather than literal
   colours.
3. Use it everywhere that look appears.

A theme can only move what is named. `bg-black/50` at a call site is invisible
to it, and every one of those is a place a future theme will be wrong.

### How this is enforced

ESLint fails the build on `<button>`, `<input>`, `<select>`, `<textarea>` and
`<dialog>` anywhere in the repo. The exceptions are listed by filename in
`eslint.config.ts`: the three components that own those elements, and test files,
where a raw element stands in for an arbitrary caller-supplied child.

Adding a filename to that list is not how you satisfy the rule. The list grows
only when a new primitive gets an owner.

---

## 10. Icons

**All icons come from `@hugeicons/core-free-icons`, and are drawn by
`@ValenceUI/Icon`.** Remix Icon, Tabler and Lucide are all banned in ESLint, so a
second set cannot come back a file at a time. The renderer, `HugeiconsIcon`, is
banned too: a call site names the icon it wants and `Icon` decides how it is
drawn, which is what keeps the set swappable in one file.

```tsx
import { Icon } from '@ValenceUI/Icon';
import { Home01Icon } from '@hugeicons/core-free-icons';

<Icon of={Home01Icon} size={18} />;
```

**Say "this one is selected" with `isActive`, not with a different glyph.** The
free set is one style, so today an active icon is the same drawing stroked
heavier; a licensed set has filled twins, and `whenActive` is where they go.
Reaching for a different glyph to mean selected is how a section turns into a
camcorder.

**No raw SVG anywhere in the codebase.** No inline `<svg>` elements, no
`.svg` imported as a component, no SVG strings.

The sole exception is brand assets — logo, wordmark, favicon — which live as
files in `packages/ui/assets/brand/` and are referenced by URL, never inlined
into JSX. That exception also covers the marks the icon set does not draw: it
has no brand glyphs, so a browser or a service is named in words or given a
generic shape rather than approximated with the nearest thing.

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
