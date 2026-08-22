# ADR-0020: Draw every icon from Hugeicons, through one component

- **Status:** Superseded
- **Date:** 2026-08-18
- **Deciders:** Marques Scripps
- **Supersedes:** the icon clause of [0018](0018-fluxui-on-radix-and-shadcn-conventions.md)
- **Superseded by:** [ADR-0028](0028-icons-from-phosphor-at-two-weights.md)

## Context

Three documents named three different icon sets, and none of them named the one
the code used.

- `CLAUDE.md` rule 9 said icons come from `@tabler/icons-react`.
- The ESLint rule banned Tabler and said icons come from `@remixicon/react`.
- [ADR-0018](0018-fluxui-on-radix-and-shadcn-conventions.md), accepted the day
  before this one, listed `lucide-react` under what it was not adopting: "Icons
  stay Remix Icon. Swapping an icon set buys nothing and changes every glyph in
  the product."

The code used Remix Icon: 97 distinct glyphs across 62 files, imported as one
component each and dropped into JSX directly.

That last sentence of 0018 was right about the cost and wrong about the buy, for
a reason it could not have known: the owner wants the styles a licensed set
offers — solid, duotone, twotone, bulk — and Remix Icon does not sell them.
Staying put is not free either; it is a decision to never have them.

## Decision

**Every icon comes from Hugeicons**, whose free set is 5,443 icons in one
Stroke Rounded style, MIT licensed. Remix Icon, Tabler and Lucide are banned in
ESLint together, so a second set cannot come back a file at a time.

**Every icon is drawn by `@ValenceUI/Icon`, never by the renderer.** Hugeicons
ships icons as data and one component that draws them, so a call site names what
it wants and `Icon` decides how it is drawn:

```tsx
<Icon of={Home01Icon} size={18} />
```

`HugeiconsIcon` itself is banned in ESLint alongside the other sets. The
indirection is the entire point: the free set is one style and the licensed set
is nine, and moving between them is a change to one file and one package rather
than to six hundred call sites.

**A thing in force is said with `isActive`, not with a second glyph.** The free
set has no filled twins, so an active icon is the same drawing stroked more
heavily. `Icon` also takes `whenActive`, which draws a different glyph instead —
dormant today, and where the filled twins go if the licensed set is ever bought.

**The licensed set is not used, and not vendored.** It is not published to npm;
it comes with a licence. Nothing in this repository should reach for those
assets by another route.

## Consequences

### What this gets us

One set, named the same way in the lint rule, the standards and the code, for
the first time.

A licence is now the only thing between Flux and the styles the owner wants. The
package name changes, `Icon` gains a `variant`, and nothing else moves.

Six hundred call sites stopped importing icons one component at a time. Changing
how every glyph in the product is drawn — its weight, its size, how it says a
thing is selected — is now an edit to one file.

### What this costs us

**Brand marks are gone.** Hugeicons draws no Chrome, Firefox, Edge, Opera or
Safari mark, and the admin session list used all five to say which browser a
viewer was on. It now says something simpler and true: a globe for a browser, a
television for a television, with the browser's own name in words beside it.
That is a real loss of shape, accepted because inventing brand marks is worse.

**Active states are weaker until a licence is bought.** The dock distinguished
the current section by drawing its filled twin. It now strokes the same glyph
more heavily, alongside the weight, colour and travelling mark it already had.

**Every call site is one component heavier.** `<Icon of={X} />` rather than
`<X />`, and two imports rather than one.

**The glyphs are not the same glyphs.** Ninety-seven Remix icons map onto
seventy-three Hugeicons ones, because pairs that differed only by fill collapse
into a single drawing. Some are close matches rather than exact: a dice, a
pulse, an unlink.

### What this forecloses

Icons that only one set draws. Anything Hugeicons lacks is now a request
upstream or a brand asset, not an import from somewhere else.

## Alternatives considered

**Lucide.** Mapped cleanly — 96 of 97 icons resolved — and is the set shadcn's
own conventions assume. It loses on the only axis that made this worth doing: it
has one style, sells no others, and would have to be migrated away from again.

**Stay on Remix Icon.** What 0018 decided. It has the filled twins the dock
wants and brand marks the session list wants, and no path to the styles the
owner is actually after.

**Keep Remix Icon for brand marks alone.** Two icon sets, one of them for five
glyphs, and a rule that cannot be linted simply. The session list is better off
saying less.

## Revisit when

A Hugeicons licence is bought — at which point `whenActive` gets its filled
twins and `Icon` grows a style, and this ADR's costs section is mostly answered.

The set is missing something a screen genuinely needs, often enough that
"request it upstream" stops being a real answer.
