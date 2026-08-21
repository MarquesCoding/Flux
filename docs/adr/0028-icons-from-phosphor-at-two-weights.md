# ADR-0028: Draw every icon from Phosphor, at two weights

- **Status:** Accepted
- **Date:** 2026-08-21
- **Deciders:** Marques Scripps
- **Supersedes:** [0020](0020-icons-from-hugeicons-through-one-component.md)
- **Superseded by:** —

## Context

[ADR-0020](0020-icons-from-hugeicons-through-one-component.md) chose Hugeicons
and said plainly what it was buying: one free style now, with nine licensed
styles available later if the owner wanted them. It also wrote down the cost —
"the free set has no filled twins, so an active icon is the same drawing stroked
more heavily" — and built `Icon` so that the set could be replaced in one file.

That cost turned out to matter more than expected. An icon that says a thing is
on by being a fifth of a pixel thicker does not say it. Every place in Flux that
wants to show state — the nav dock, the player's toggles, whether a thing is
kept or favourited — was reaching for a distinction the set could not draw, and
the only way to get it was to buy the licensed set.

The other half is style. Flux is a media application, not a dashboard: its
glyphs sit over artwork and beside heavy display type, and a hairline wireframe
reads as unfinished next to them.

## Decision

**Every icon comes from Phosphor**, MIT licensed, 1,606 icons each drawn at six
weights: thin, light, regular, bold, fill and duotone. Hugeicons, Remix Icon,
Tabler and Lucide are banned together in ESLint, so a second set cannot come
back a file at a time.

**Every icon is drawn by `@FluxUI/Icon`, never by the renderer.** Phosphor ships
each icon as a component, so `Icon` names the icon it is given and decides how it
is drawn:

```tsx
<Icon of={HouseIcon} size={18} />
```

Importing `IconBase`, `IconContext` or the SSR entry point directly is banned
alongside the other sets, for the reason 0020 gave and which has now been tested
in practice: the set behind `Icon` was replaced across sixty-eight files, and no
call site changed except the name of the icon it asked for.

**A glyph at rest is duotone; a glyph in force is filled.** These are two
drawings of one icon rather than one drawing at two stroke widths, which is what
0020 could not offer. `whenActive` still takes a different glyph where the pair
is a different idea rather than the same idea filled in — a play that becomes a
pause. A caller may name any of the six weights where a screen needs something
else.

**Names carry the `Icon` suffix.** Phosphor 2.1 deprecated the bare exports in
favour of `HouseIcon` over `House`; the suffixed names are the ones to use, and
they also stop an icon colliding with `File`, `Image` or `Link`.

## Consequences

### What this gets us

- State that is visible. Filled versus duotone is a change anybody can see.
- Icons with enough weight to sit over artwork.
- Six weights free, where the previous set charged for the second.
- Every icon Flux uses, checked one by one before committing: the seventy-seven
  in use all exist, including `Subtitles`, `PictureInPicture`, `Television`,
  `Screencast` and `FilmSlate`, which media applications need and general UI
  sets tend not to carry.

### What this costs us

- 1,606 icons rather than 5,443. Wider than it sounds, since Phosphor's count
  excludes weights, but a specific glyph is likelier to be absent than before.
- Phosphor's icons are components, not data, so an icon that is merely _named_ by
  a value — a device kind, a share reason — now carries a component in that
  value. `PhosphorIcon` is the type for those.
- A second rename wave from upstream would touch every call site again, though
  the `*Icon` names are the ones that survived the last one.

### What this forecloses

- Hugeicons' licensed styles, which 0020 was holding the door open for. That door
  closes; the reason for wanting it is what Phosphor now gives away.

## Alternatives considered

- **Keyline Icons** — the set that prompted this, and the reason the check was
  worth doing. 503 icons built for shadcn, with no cast, picture-in-picture,
  subtitle, television, film, flame or gauge glyph. A dozen of ours had no
  equivalent, all of them clustered in the player. It is also v0.1.0.
- **Solar** — 7,000 icons with a handsome duotone, but CC-BY-4.0, so a shipped
  product owes visible attribution, and it is distributed as Iconify JSON rather
  than components.
- **Iconsax** — has the weights, but the React port is unofficial and at v0.0.8.
- **Buying Hugeicons Pro** — solves the state problem and nothing else, costs
  money, and leaves the wireframe look.
- **Staying put** — a decision to never show state in an icon.

## Revisit when

- A screen needs a glyph Phosphor does not draw, twice. Once is a workaround;
  twice is a set that does not fit.
- Phosphor renames its exports again.
- Flux ships a theme where duotone at rest is wrong — a high-contrast mode, say —
  at which point the resting weight becomes a token rather than a constant.
