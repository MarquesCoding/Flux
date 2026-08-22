# ADR-0021: Dialogs are built on Base UI

- **Status:** Accepted
- **Date:** 2026-08-18
- **Deciders:** Marques Scripps
- **Supersedes:** [0018](0018-valenceui-on-radix-and-shadcn-conventions.md), for its
  primitive clause and for dialogs only
- **Superseded by:** —

## Context

[ADR-0018](0018-valenceui-on-radix-and-shadcn-conventions.md) chose Radix over Base
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

The cause was eventually measured in a browser rather than reasoned about, and it
was **the easing curve, not the primitive**. Sampling the panel's opacity through
a dismissal found it at 0.54 three milliseconds in and 0.10 after thirty-four,
spending the remaining hundred milliseconds fading from invisible to gone.
`--ease-out` is `cubic-bezier(0.23, 1, 0.32, 1)`, deliberately front-loaded so
that a thing arriving feels immediate; applied to a departure it removes the
panel before an eye can follow it. The animation had been running correctly the
whole time.

This matters for how much of this ADR is load-bearing. The Radix diagnosis that
prompted the move — that its panel unmounted before it could animate — was never
demonstrated, and the curve would have made a working Radix animation look
identical to a broken one. Base UI is measured to work: `data-closed` is set,
`getAnimations()` reports `exit`, and the node is removed a hundred and
forty-nine milliseconds later. Whether Radix would now do the same with the curve
corrected is untested.

Three earlier attempts at this were guesses presented as diagnoses — a
content-type header, a claim the motion was too subtle, and the Radix
attribution above. The second was closer than it was given credit for.

## Decision

**Leaving is eased on `--ease-in-out`, arriving on `--ease-out`.** This is one
half of the fix for the reported bug and it is independent of the primitive.

The other half was not in ValenceUI at all. Both detail dialogs derived their
contents from the same value that dismisses them, so an overview, a cast and a
seasons list all became nothing in the render that began the exit, and the panel
spent that exit as an empty box. `useHeldWhileLeaving` in the web app holds them
until the leaving is done. Confirmed working together.

**`Dialog` is built on Base UI. Nothing else is.**

`@base-ui/react` is a dependency of ValenceUI, and `packages/ui/src/components/Dialog`
is the only file permitted to import it. Building a second component on Base UI
is a new decision to be taken on its own merits, not a precedent set by this one.
Everything else in ValenceUI stays on Radix under 0018.

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

Dialogs close visibly — though that is owed to the curve and to the web app
holding its content, rather than to Base UI.

An exit animation that is demonstrably held open by the primitive rather than
assumed to be, which is worth something on its own after three wrong diagnoses.

### What this costs us

**Two primitive libraries for one component.** `@base-ui/react` is installed for
a single file. That is a real cost and the reason this ADR is scoped as narrowly
as it is: the alternative reading — "ValenceUI is moving to Base UI" — is not what
was decided.

**One component speaks a different attribute vocabulary.** Every other popup in
ValenceUI animates off `data-[state]`; `Dialog` animates off `data-open`. Anyone
copying motion between them has to translate.

**A media card is left with a focus ring** after the dialog over it is dismissed.
Focus is restored to it correctly, and it styles that with `focus-visible` rather
than `focus`, so the browser is carrying focus-visible state through a
programmatic restore that began from a click. This is open. The obvious fix —
declining to restore focus after a pointer dismissal — is the one that broke the
exit animation, so it needs a different answer.

## Alternatives considered

**Rebuild ValenceUI from the shadcn registry on Base UI.** Tried, and reverted. All
sixty-three registry components were generated and the fifty-three hand-written
ones set aside, on the reasoning that a complete set is a better thing to restyle
from than a set grown one screen at a time. It was abandoned because it delivered
nothing visible — the generated layer was imported by no file, so every screen
still rendered the old components — while adding a second untested component
library, eight dependencies, a lint and coverage quarantine, and two animation
vocabularies to the tree. The dialog fix was the only part that was worth
anything, and it did not need the other sixty-two components to work.

**Stay on Radix and keep looking.** This is now the strongest alternative rather
than the weakest, because the bug turned out not to be the primitive. Reverting
`Dialog` to Radix with the curve corrected would drop `@base-ui/react` entirely
and cost nothing if it works. It is untested, which is the only reason this ADR
still reads the way it does.

**Move all of ValenceUI to Base UI.** The honest end state if more components turn
out to need it. It is a much larger decision than one bug justifies, and taking
it now would be deciding it by momentum rather than on the merits.

## Revisit when

`Dialog` is tried on Radix again with the corrected curve. If it animates, this
ADR should be superseded by one that removes `@base-ui/react`, since the reason
for adopting it did not survive being measured.

A second component needs Base UI. Two is a pattern, and at two the question of
moving the library properly should be asked rather than answered one component at
a time.

A way is found to keep a pointer dismissal from leaving a ring behind without
holding focus inside the closing popup, since that is the one thing tried so far
and it cost the animation.
