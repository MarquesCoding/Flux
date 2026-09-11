# ADR-0030: Draw every icon from Hugeicons' free stroke set, and let the control carry its state

- **Status:** Accepted
- **Date:** 2026-09-11
- **Deciders:** Marques Scripps
- **Supersedes:** [0028](0028-icons-from-phosphor-at-two-weights.md)
- **Superseded by:** —

## Context

[ADR-0028](0028-icons-from-phosphor-at-two-weights.md) left Hugeicons for Phosphor
for two reasons: the free Hugeicons set has no filled twins, so an icon that is on
could only say so by being drawn a little thicker; and a hairline wireframe read as
unfinished beside the heavy, glossy surfaces Valence had at the time.

The second reason has gone. Valence has since been redrawn flat: buttons are solid
fills with a hairline edge, every floating surface is one flat colour with a
hairline and a shadow, and cards are two flat layers. Against that, Phosphor's bold
weight is the heaviest thing on the page, and a light, rounded line is what the
rest of the interface is now drawn in. The owner has chosen Hugeicons again for
that look.

The first reason has not gone, so it has to be answered some other way than by
the glyph.

## Decision

**Every icon comes from `@hugeicons/core-free-icons`**, drawn by `@ValenceUI/Icon`
through `HugeiconsIcon` from `@hugeicons/react`. Phosphor joins Remix Icon, Tabler
and Lucide on the banned list in ESLint, and importing `HugeiconsIcon` anywhere but
`Icon` is banned, for the reason both earlier decisions gave: a call site names the
icon it wants and `Icon` decides how it is drawn.

```tsx
<Icon of={Home01Icon} size={18} />
```

**State belongs to the control, not the glyph.** The places that showed state by
filling an icon already have a stronger signal of their own, and that signal is now
the one relied on:

- the bar's current place is the sliding mark behind it and its colour;
- a toggle that is on is drawn in the accent, or pressed, by the control holding it;
- a kept or favourited thing says so in its label and colour where it matters.

`Icon` still draws an icon in force at a heavier stroke, as a second cue rather than
the only one. Where a pair is two ideas rather than one idea switched on — play and
pause, sound and silence — `whenActive` names the other glyph, and `Icon` hands it to
`HugeiconsIcon` as its alternate so the swap is one element, not two.

**One stroke at rest, a heavier one in force.** A little heavier than the set's own
default at rest, so a glyph over artwork still holds its line; heavier again in
force. Both are constants in `Icon`, not choices made at call sites.

**Duotone and weights are gone.** The free set is one style. `weight` is removed from
`Icon`'s props and `--valence-icon-second-tone` from the stylesheet.

**Names are Hugeicons' own** — `Home01Icon`, `Settings02Icon`, `Notification01Icon`.
The numbered variants are how the set names alternatives; the one chosen for each
Phosphor icon it replaced is recorded in the pull request that made the change.

## Consequences

### What this gets us

- One line style across the interface, matching the flat surfaces it sits on.
- 6,025 free icons, every one Valence uses among them — including cast, subtitles,
  picture-in-picture, dice and a cloud that is off.
- State that does not depend on telling two drawings of one icon apart.

### What this costs us

- No filled state. Anywhere a control cannot show it is on by itself, the icon's
  heavier stroke is all there is, which is what 0028 found too faint to rely on.
- A third icon swap across every file that draws one, though `Icon` again kept every
  call site to a change of name.
- Numbered names are less memorable than Phosphor's, so finding the right glyph
  means searching the set rather than guessing.

### What this forecloses

- Phosphor's six weights and its duotone.
- Filled twins, until the licensed Hugeicons styles are bought or the set changes.

## Revisit when

- A control needs to show state that neither its own styling nor a different glyph
  can carry, twice. That is the case for the licensed solid styles.
- The free set drops or renames an icon Valence uses.
