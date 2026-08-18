# ADR-0021: Dialogs are built on Base UI

- **Status:** Accepted
- **Date:** 2026-08-18
- **Deciders:** Marques Scripps
- **Supersedes:** [0018](0018-fluxui-on-radix-and-shadcn-conventions.md), for its
  primitive clause and for dialogs only
- **Superseded by:** —

## Context

[ADR-0018](0018-fluxui-on-radix-and-shadcn-conventions.md) chose Radix over Base
UI while saying plainly that Base UI was the better library. The reason was the
ecosystem: "every animation recipe worth borrowing is written against Radix's
`data-[state]` attributes."

Dialogs never animated closed. They opened correctly and vanished on dismissal.

The stylesheet was not the problem, and was checked more than once. The built CSS
carried `@keyframes exit`, the `animate-out` utility, `--duration-leaving`, and
the `data-[state=closed]` selectors, and `tw-animate-css` was correctly feeding
`--tw-duration` into `animation-duration`. The markup matched shadcn's own Radix
dialog. Call sites were checked for conditional mounting, which would have
unmounted the panel before Radix saw it, and none did it.

What is left is Radix itself: its panel unmounts the instant it is dismissed, so
there is nothing on screen for the exit animation to run on. Base UI holds the
element through the animation and marks it `data-closed`.

Two earlier attempts at this were guesses presented as diagnoses — a
content-type header, then a claim the motion was merely too subtle — and both
were wrong. This one is recorded because it was arrived at by elimination rather
than by hypothesis.

## Decision

**`Dialog` is built on Base UI. Nothing else is.**

`@base-ui/react` is a dependency of FluxUI, and `packages/ui/src/components/Dialog`
is the only file permitted to import it. Building a second component on Base UI
is a new decision to be taken on its own merits, not a precedent set by this one.
Everything else in FluxUI stays on Radix under 0018.

The leaving classes hang on `data-open` and `data-closed` rather than
`data-[state=open]` and `data-[state=closed]`, because those are what Base UI
sets. This is the one place in the codebase speaking that vocabulary.

**Focus restoration is left at Base UI's default**, which hands focus back to
whatever opened the dialog. Narrowing that to keyboard dismissals was tried and
reverted: it stopped the exit animation, because a popup that keeps focus while
it is closing is torn down rather than animated out. The behaviour it was aimed
at — a media card left ringed after the dialog over it was dismissed — is
recorded below as open rather than traded for the animation this ADR exists to
get.

## Consequences

### What this gets us

Dialogs close visibly, which is what 0018 traded Base UI away to get and did not
get.

### What this costs us

**Two primitive libraries for one component.** `@base-ui/react` is installed for
a single file. That is a real cost and the reason this ADR is scoped as narrowly
as it is: the alternative reading — "FluxUI is moving to Base UI" — is not what
was decided.

**One component speaks a different attribute vocabulary.** Every other popup in
FluxUI animates off `data-[state]`; `Dialog` animates off `data-open`. Anyone
copying motion between them has to translate.

**A media card is left with a focus ring** after the dialog over it is dismissed.
Focus is restored to it correctly, and it styles that with `focus-visible` rather
than `focus`, so the browser is carrying focus-visible state through a
programmatic restore that began from a click. This is open. The obvious fix —
declining to restore focus after a pointer dismissal — is the one that broke the
exit animation, so it needs a different answer.

## Alternatives considered

**Rebuild FluxUI from the shadcn registry on Base UI.** Tried, and reverted. All
sixty-three registry components were generated and the fifty-three hand-written
ones set aside, on the reasoning that a complete set is a better thing to restyle
from than a set grown one screen at a time. It was abandoned because it delivered
nothing visible — the generated layer was imported by no file, so every screen
still rendered the old components — while adding a second untested component
library, eight dependencies, a lint and coverage quarantine, and two animation
vocabularies to the tree. The dialog fix was the only part that was worth
anything, and it did not need the other sixty-two components to work.

**Stay on Radix and keep looking.** Defensible, and it is where three separate
attempts already ended. The cost of continuing is unbounded and the cost of this
is one dependency.

**Move all of FluxUI to Base UI.** The honest end state if more components turn
out to need it. It is a much larger decision than one bug justifies, and taking
it now would be deciding it by momentum rather than on the merits.

## Revisit when

A second component needs Base UI. Two is a pattern, and at two the question of
moving the library properly should be asked rather than answered one component at
a time.

A way is found to keep a pointer dismissal from leaving a ring behind without
holding focus inside the closing popup, since that is the one thing tried so far
and it cost the animation.
