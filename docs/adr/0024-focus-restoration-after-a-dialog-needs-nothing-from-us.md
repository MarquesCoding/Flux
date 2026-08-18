# ADR-0024: Focus restoration after a dialog needs nothing from us

- **Status:** Accepted
- **Date:** 2026-08-19
- **Deciders:** Marques Scripps
- **Supersedes:** the focus-restoration consequence of [0021](0021-dialogs-are-built-on-base-ui.md)
- **Superseded by:** —

## Context

[0021](0021-dialogs-are-built-on-base-ui.md) left one item open, and stated a
mechanism for it: "A media card is left with a focus ring after the dialog over
it is dismissed. Focus is restored to it correctly, and it styles that with
`focus-visible` rather than `focus`, so the browser is carrying focus-visible
state through a programmatic restore that began from a click."

That mechanism was never measured. It was inferred from reading, during a
session in which the browser extension had disconnected, and four earlier
diagnoses of a neighbouring dialog bug had already been wrong for the same
reason. It was written down as fact, and then acted on: #113 removed
`focus-visible:ring` from `MediaCard` entirely. That commit was honest about the
price — "a real loss: `focus-visible` is how somebody moving through a rail on a
keyboard, or a remote, can see where they are. Nothing replaces it here yet" —
and expected the ring back once 0021's open item was fixed.

So an accessibility affordance was deleted, and an immutable record acquired a
cause that had never been observed.

## Decision

**Focus restoration stays exactly as it is** — Base UI's default, untouched.
Nothing is added to narrow it, delay it, or strip focus-visible from the element
it restores to.

**`MediaCard` carries `focus-visible:ring` again.**

**0021's open item is closed as not reproducing.** A future change to the dialog
should not be constrained by it.

The measurement, taken in Chrome against a real card, each dismissal driven by
hand and the restored element inspected:

| dismissal                | focus restored to | `:focus-visible` |
| ------------------------ | ----------------- | ---------------- |
| close button, by pointer | the card          | false            |
| backdrop, by pointer     | the card          | false            |
| Escape, by keyboard      | the card          | true             |

Every row is correct. A pointer dismissal restores focus without a ring; a
keyboard dismissal restores it with one, which is what a keyboard user needs.
Script focus alone does not set focus-visible either. Whatever was seen in #113,
the browser's heuristic survives this dialog's restore intact.

## Consequences

### What this gets us

Keyboard and remote navigation has a visible focus indicator in a rail again,
which is the surface Flux is mostly used on.

0021's open item stops steering work. It carried a warning — that the obvious
fix breaks the exit animation — which would have sent the next person chasing a
fault that is not there.

### What this costs us

Two ADRs now have to be read together to know what is true about focus, and the
older one is the one somebody lands on first. The index says so, but that only
works for somebody who reads the index.

A regression here is caught by a browser or not at all. The test asserts the
class and that Tab lands on the card, which is as far as jsdom can speak — it
runs no styles and has no notion of `:focus-visible`.

### What this forecloses

Nothing. Narrowing focus restoration remains available if a real fault ever
turns up; it simply has no fault to answer to now.

## Alternatives considered

**Leave the ring off and close the item quietly.** Rejected: the affordance was
removed for a stated reason, and the reason is gone.

**Edit 0021.** Not available — accepted ADRs are immutable, which is the rule
that makes this document exist.

## Revisit when

Anyone reports a ring appearing after a mouse press. The measurement above is
one browser on one machine; Safari and Firefox implement the `:focus-visible`
heuristic themselves and were not driven.

The dialog's focus handling changes for any other reason, since the measurement
is of Base UI's default and nothing else.
